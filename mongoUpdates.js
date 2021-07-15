// NOTE this file is only for testing mongo updates, not used anywhere

const fs = require("fs");
const mongo = require("mongodb");

const uri = "mongodb://localhost:" + process.env.MONGO_URI + "/";
const mongoClient = mongo.MongoClient(uri, {useUnifiedTopology: true});

// TODO change these to test time for update
const dbName = "bookData";
const wordCollection = "wordVals";
const metaCollection = "titleMetadata"

// insert new docs to the existing title metadata collection,
// if a title_key that already exists is inserted (this shouldn't happen and it doesn't matter if it does) it will be inserted because the object
// id is th unique identifier not the title key
async function titleInsert(titleJsonArr) {
	console.time("titleInsert");
	try {
		// init db stuff
		await mongoClient.connect();
		const database = mongoClient.db(dbName);
		
		// insert multiple docs
		await database.collection(metaCollection).insertMany(titleJsonArr);

	} catch (err) {
		console.log("oh no");
		console.log(err);
	} finally {
		mongoClient.close();
		console.timeEnd("titleInsert");
	}
}

// updates collection of words that are {word_key: word, title_vals: {title0: 0.2, ..., titleN: 0.01}}
// if the word_key isn't found, a new doc is inserted (upsert option)
// else if a new title given is the same as one already in title_vals (this shouldn't happen and doens't rlly matter if it does) the val is overwritten
// else the new titles and their values are added to title_vals
// I believe the updates run async, which is fine because there won't be multiple updates to the same word_key in each json set
async function wordValsUpdate(wordJsonArr) {
	console.time("wordValUpdate");

	try {
		// init db stuff
		await mongoClient.connect();
		const database = mongoClient.db(dbName);
		const collection = database.collection(wordCollection);

		// if the doc with word_key isn't found, this option creates it
		const options = {upsert: true};

		// init a few vars for each word_key object in the json array inputted
		var filter;
		var updateDoc;
		var titleVals;
		var titleName;
		var titleVal;
		var resPromiseArr = [];

		// go through each word object and update
		for (var wordObj of wordJsonArr) {
			// query for doc to update
			filter = {word_key: wordObj["word_key"]};

			// values to update
			titleVals = wordObj["title_vals"];

			// update each title value
			for (var title in titleVals) {
				titleName = "title_vals." + title;
				subObj = {};
				subObj[titleName] = titleVals[title];

				// update expression example: {$set: {title_vals.titleN: 0.3}}
				updateDoc = {$set: subObj};

				// push Promise so updates can run async
				resPromiseArr.push(collection.updateOne(filter, updateDoc, options));
			}

			// let Promises resolve
			await Promise.all(resPromiseArr);
		}
	} catch (err) {
		console.log("oh no");
		console.log(err);
	} finally {
		// disconnect 
		mongoClient.close();
		console.timeEnd("wordValUpdate");
	}
}


// update all fields in a collection with an encoded uri
async function addAmzField(amzBaseURL, amzCode) {
	console.time("updateField");
	try {
		await mongoClient.connect();
		const database = mongoClient.db(dbName);
		const collection = database.collection(wordCollection);

		// get every doc (cursor is like a yield generator thing)
		var cursor = await database.collection(metaCollection).find();

		var updatePromises = [];
		// set field in each doc found
		await cursor.forEach((doc) => {
			// get data needed for url and update
			var docTitleKey = doc.title_key;
			var docTitle = doc.title_data.unfiltered_title;

			// TODO change this to whatever form it's supposed to be
			var fullURL = amzBaseURL + docTitle + "&whatevertagparam=" + amzCode;
			var encodedURL = encodeURI(fullURL);

			// push promise so that updates run async, adds url to title_data obj (what is returned to client side)
			updatePromises.push(database.collection(metaCollection).updateOne({title_key: docTitleKey}, {$set: {"title_data.amz_link": encodedURL}}));
		});

		// let promises resolve
		await Promise.all(updatePromises);

	} catch (err) {
		console.log("error");
		console.log(err);
	} finally {
		mongoClient.close();
		console.timeEnd("updateField");
	}
}

/*
var rawTitle = fs.readFileSync("/mnt/c/Users/kyler/pyguy/bookOracle/v6/data/title_data_json_arrays/set0_2100_4100.json");
var titleJsonArr = JSON.parse(rawTitle);
titleInsert(titleJsonArr, metaCollection);
*/

/*
var rawWords = fs.readFileSync("/mnt/c/Users/kyler/pyguy/bookOracle/v6/data/master_dict_json_arrays/set0_2100_4100.json");
var wordJsonArr = JSON.parse(rawWords);
wordValsUpdate(wordJsonArr);
*/

var amzBaseURL = "https://amazon.com/s?k=";
var imaginaryCode = "ABC 123";
addAmzField(amzBaseURL, imaginaryCode);


