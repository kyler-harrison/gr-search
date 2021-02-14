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

router.get("/", (req, res) => {
	var returnData = {originalQuery: null, dataArr: null, message: null};
	res.render("index.ejs", returnData);
	return;
});

router.post("/", async (req, res) => {
	var query = req.body.query;
	var returnData = {originalQuery: query, message: null, dataArr: null};

	/*
	// TESTING redis
	// set key val
	redisClient.setex("urmom", 3600, JSON.stringify({"word": {"title": 0.2}}));
	// get val from key, returns JSON string
	var maxer = 100000;
	var j = 0;
	// TODO test async stuff, get array of words and see input-output order, do the Promise array thing like with db if needed
	for (var i = 0; i < maxer; i++) {
		redisClient.get("urmom", (err, data) => {
			if (err) {
				console.log("redis error");
			} else {
				if (i == 900) {
					console.log(JSON.parse(data).word);
				}
			}
		});
	}
	console.log("outside");
	*/
	
	// python server for text processing
	var pyPortPath = "http://localhost:" + process.env.PY_PORT;
	var pyRes = await axios.post(pyPortPath, {"unfilteredQuery": query});
	var pyResObj = pyRes.data;
	var returnMessage = pyResObj.message;

	// check if the query was too long
	if (returnMessage == "max_len") {
		returnData["message"] = "too many words pal, try < 50";
		res.render("index.ejs", returnData);
		return;
	}

	// NOTE duplicates are handled by py server 
	var filteredQueryArray = pyResObj.filteredQueryArray;

	// py server returned no valid words
	if (filteredQueryArray.length == 0) {
		returnData["message"] = "No valid words";
		res.render("index.ejs", returnData);
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
		res.render("index.ejs", returnData);
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

	returnData["message"] = "valid query";
	returnData["dataArr"] = metaQueryResults;
	res.render("index.ejs", returnData);
	return;
});

module.exports = router;
