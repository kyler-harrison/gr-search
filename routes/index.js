const express = require("express");
const router = express.Router();
const axios = require("axios");
const database = require("../dbConfig.js");
const collection = "wordVals";

router.get("/", (req, res) => {
	var returnData = {originalQuery: null, dataArr: null, message: null};
	res.render("index.ejs", returnData);
	return;
});

router.post("/", async (req, res) => {
	var query = req.body.query;
	var returnData = {originalQuery: query, message: null, dataArr: null};
	
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

	var filteredQueryArray = pyResObj.filteredQueryArray;

	// py server returned no valid words
	if (filteredQueryArray.length == 0) {
		returnData["message"] = "No valid words";
		res.render("index.ejs", returnData);
		return;
	}
	
  // access db client by doing database.get().mongoFunctionYouWant()
	// TODO check cache, query those you still need
	var queryPromises = [];
	var counter = 0;
	for (var word of filteredQueryArray) {
		// pushes pending db Promise into array, allows multiple queries to run in parallel (I think)
		queryPromises.push(database.get().collection(collection).findOne({word_key: word}));
	}
	// NOTE 99 words takes ~6-7 seconds to return page local - cache em!

	// for each Promise in the array, await its result
	var queryResults = await Promise.all(queryPromises);
	//console.log(await Promise.all(queryResults));
	console.log(queryResults);

	// TODO cache words

	// no scores returned from db
	if (queryResults.length == 0) {
		returnData["message"] = "No results found";
		res.render("index.ejs", returnData);
		return;
	}

	// TODO define these after search, just testing here
	returnData["message"] = "valid query";
	returnData["dataArr"] = ["whatever"];
	res.render("index.ejs", returnData);
	return;
});


module.exports = router;
