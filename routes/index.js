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
const redisExpiration = 3600;  // seconds, == 1 hour

router.get("/", async (req, res) => {
	// TODO rando db query (might do on err cases - haven't tested):
	// db.collectionName.aggregate([{ $sample: { size: 1 } }])

	var query = req.query.search;  // user query (passed as param search, referenced as query throughout rest of this fun)
	var returnData;  // init return json var

	if (query == null) {
		returnData = {resStatus: "load", originalQuery: null, dataArr: null, message: null};
		res.render("index.ejs", returnData);
		return;
	} 

	// TODO change all return objects, rm originalQuery - no longer needed because not reloading - web dev wizard
	returnData = {resStatus: null, originalQuery: query, message: null, dataArr: null};  // at least return inputted query
	
	// python server for text processing
	var pyPortPath = "http://localhost:" + process.env.PY_PORT;
	var pyRes = await axios.post(pyPortPath, {"unfilteredQuery": query});
	var pyResObj = pyRes.data;
	var returnMessage = pyResObj.message;

	// check if the query was too long
	if (returnMessage == "max_len") {
		returnData["message"] = "too many words pal, try < 50";
		res.send({"bo": "jackson"});
		//res.render("index.ejs", returnData);
		return;
	}

	// NOTE duplicates are handled by py server 
	var filteredQueryArray = pyResObj.filteredQueryArray;

	// py server returned no valid words
	if (filteredQueryArray.length == 0) {
		returnData["message"] = "No valid words";
		res.send({"bo": "jackson"});
		//res.render("index.ejs", returnData);
		return;
	}
	
	// query redis cache and add pending Promises to array
	var redisPromises = [];
	for (var word of filteredQueryArray) {
		redisPromises.push(asyncRedisClient.get(word));
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
	// redis rm: now initialize finalWordResults and change wordsToQuery to filteredQueryArray in the loop below, rm cache later

  // access db client by doing database.get().mongoFunctionYouWant()
	//var finalWordResults = [];
	var queryPromises = [];
	for (var word of wordsToQuery) {
		// pushes pending db Promise into array, allows multiple queries to run in parallel (I think)
		queryPromises.push(database.get().collection(wordCollection).findOne({word_key: word}));
	}

	// for each Promise in the array, await its result
	var queryResults = await Promise.all(queryPromises);
	
	// iterate through queries and add results to final word array and cache
	for (var queryObj of queryResults) {
		// put object of {title: score} in the array
		finalWordResults.push(queryObj["title_vals"]);

		// add this word and its data to redis cache
		asyncRedisClient.setex(queryObj["word_key"], redisExpiration, JSON.stringify(queryObj["title_vals"]));
	}
	
	// no scores returned from db
	if (finalWordResults.length == 0) {
		returnData["message"] = "No results found";
		//res.render("index.ejs", returnData);
		res.send({"bo": "jackson"});
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
	for (var titleTuple of ratioScores) {
		// search by title (the first entry in the "tuple" which is just a sub array)
		metaQueryPromises.push(database.get().collection(metaCollection).findOne({title_key: titleTuple[0]}));
	}

	// resolve mongo meta query results
	var metaQueryResults = await Promise.all(metaQueryPromises);

	// clean up and return data
	returnData["message"] = "valid query";
	returnData["dataArr"] = metaQueryResults;
	//res.render("index.ejs", returnData);
	res.send({"bo": "jackson"});
	return;
});

module.exports = router;

