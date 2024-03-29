const express = require("express");
const router = express.Router();
const axios = require("axios");
const asyncRedis = require("async-redis");
const database = require("../dbConfig.js");

const wordCollection = "wordVals";  // mongo collection name of {word_key: word, title_vals: {title: score}} documents
const metaCollection = "titleMetadata";  // mongo collection name of {title_key: title, title_data: {...}} documents 
const maxResultsReturn = 20;  // number of titles to return

// connect async redis client
const asyncRedisClient = asyncRedis.createClient(process.env.REDIS_PORT);
asyncRedisClient.auth(process.env.REDIS_AUTH);
const redisExpiration = 3600;  // seconds, = 1 hour

// handle caught errors, assuming output appends to a log file 
function caughtError(err, res) {
	var d = new Date();
	var formattedDate = d.toLocaleString("en-us", {timeZone: "America/New_York"}) + " Eastern";
	console.log(formattedDate);
	console.log(err);
	console.log("\n");
	res.send({resStatus: null, message: "Something went wrong, please try again.", dataArr: null});
	return;
}

// main (and only) request route
router.get("/", async (req, res) => {
	var query = req.query.search;  // user query (passed as param search, referenced as query throughout rest of this fun)
	var returnData = {resStatus: null, message: null, dataArr: null};  // return json var, at least return inputted query

	if (query == null) {
		res.render("index.ejs");
		return;
	} 

	// random results requested
	if (query == "$random$") {
		
		// get random data
		try {
			var randoResults = await database.get().collection(metaCollection).aggregate([{$sample: {size: maxResultsReturn}}]).toArray();
		} catch (err) {
			caughtError(err, res);
			return;
		}
		
		// get what to send back
		var finalResults = [];
		for (var randoResult of randoResults) {
			finalResults.push(randoResult.title_data);
		}

		// clean up and return data
		returnData["resStatus"] = "valid";
		returnData["message"] = "Random it is!";
		returnData["dataArr"] = finalResults;
		res.send(returnData);
		return;
	}
	
	// python server for text processing
	var pyPortPath = "http://localhost:" + process.env.PY_PORT;

	try {
		var pyRes = await axios.post(pyPortPath, {"unfilteredQuery": query});
	} catch (err) {
		caughtError(err, res);
		return;
	}

	var pyResObj = pyRes.data;
	var returnMessage = pyResObj.message;

	// check if the query was too long
	if (returnMessage == "max_len") {
		returnData["resStatus"] = "max_len";
		returnData["message"] = "That description is too long to process. Try again with something shorter.";
		res.send(returnData);
		return;
	}

	// if python server encountered some sort of error
	if (returnMessage == "invalid") {
		caughtError("py server error, see that log", res);
		return
	}

	// NOTE duplicates are handled by py server 
	var filteredQueryArray = pyResObj.filteredQueryArray;

	// py server returned no valid words
	if (filteredQueryArray.length == 0) {
		returnData["resStatus"] = "no_valid"
		returnData["message"] = "None of those words were recognized. Try a different description.";
		res.send(returnData);
		return;
	}
	
	// query redis cache and add pending Promises to array
	var redisPromises = [];

	try {
		for (var word of filteredQueryArray) {
			redisPromises.push(asyncRedisClient.get(word));
		}
	} catch (err) {
		caughtError(err, res);
		return;
	}

	// wait for cached Promises
	var redisResults = await Promise.all(redisPromises);

	// I think it's safe to refer to the indexes of the og array and redis returns array as the same here (sorta checked)
	var wordsToQuery = [];  // array for words not found in cache
	var finalWordResults = [];  // init final array of title + val objects 

	// go through what was found in redis cache, add final results, add words left to query
	for (var i = 0; i < redisResults.length; i++) {
		if (redisResults[i] == null) {
			// words not found in cache, need to query db for 
			wordsToQuery.push(filteredQueryArray[i]);
		} else {
			// words that were found in cache, add their data ({title: score}) to the final results
			finalWordResults.push(JSON.parse(redisResults[i]));
		}
	}

  	// access db client by doing database.get().mongoFunctionYouWant()
	var queryPromises = [];

	try {
		for (var word of wordsToQuery) {
			// pushes pending db Promise into array, allows multiple queries to run in parallel (I think)
			queryPromises.push(database.get().collection(wordCollection).findOne({word_key: word}));
		}
	} catch (err) {
		caughtError(err, res);
		return;
	}

	// for each Promise in the array, await its result
	var queryResults = await Promise.all(queryPromises);
	
	// iterate through queries and add results to final word array and cache
	try {
		for (var queryObj of queryResults) {
			// put object of {title: score} in the array
			if (queryObj != null) {
				finalWordResults.push(queryObj["title_vals"]);

				// add this word and its data to redis cache
				asyncRedisClient.setex(queryObj["word_key"], redisExpiration, JSON.stringify(queryObj["title_vals"]));
			}
		}
	} catch (err) {
		caughtError(err, res);
		return;
	}
	
	// no scores returned from db
	if (finalWordResults.length == 0) {
		returnData["resStatus"] = "no_results"
		returnData["message"] = "None of those words were recognized. Try a different description.";
		res.send(returnData);
		return;
	}

	// get one object of {title: {score: 0.02, numMatch: 2}, ..., titleN: {score: 0.3, numMatch: 1}}
	var titleVals = {};
	for (var titleScores of finalWordResults) {
		// NOTE use "in" to iterate through object
		for (var titleKey in titleScores) {
			if (titleVals.hasOwnProperty(titleKey)) {
				titleVals[titleKey]["score"] += titleScores[titleKey];
				titleVals[titleKey]["numMatch"]++;
			} else {
				titleVals[titleKey] = {"score": titleScores[titleKey], "numMatch": 1};
			}
		}
	}

	// get title scores into array as [titleKey, weightedScore]
	var ratioScores = [];
	var queryLen = finalWordResults.length;
	for (scoreKey in titleVals) {
		ratioScores.push([scoreKey, titleVals[scoreKey]["score"] * titleVals[scoreKey]["numMatch"] / queryLen]);
	}

	// sort array
	ratioScores.sort((a, b) => {
		return b[1] - a[1];
	});

	// take top N results
	ratioScores = ratioScores.slice(0, maxResultsReturn);

	// query db, should push each Promise into array and resolve in same ranked order
	var metaQueryPromises = [];  // array of metadata db query Promises
	try {
		for (var titleTuple of ratioScores) {
			// search by title (the first entry in the "tuple" which is just a sub array)
			metaQueryPromises.push(database.get().collection(metaCollection).findOne({title_key: titleTuple[0]}));
		}
	} catch (err) {
		caughtError(err, res);
		return;
	}

	// resolve mongo meta query results
	var metaQueryResults = await Promise.all(metaQueryPromises);

	// get what to send back
	var finalResults = [];
	for (var metaQueryResult of metaQueryResults) {
		finalResults.push(metaQueryResult.title_data);
	}

	// clean up and return data
	returnData["resStatus"] = "valid";
	returnData["message"] = "You might like...";
	returnData["dataArr"] = finalResults;
	res.send(returnData);
	return;
});

module.exports = router;

