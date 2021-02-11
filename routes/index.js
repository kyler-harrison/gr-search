const express = require("express");
const router = express.Router();
const database = require("../dbConfig.js");
const collection = "wordVals";

router.get("/", (req, res) => {
    // access db client by doing database.get().mongoFunctionYouWant()
    database.get().collection(collection).findOne({word_key: "call"}, (err, result) => {
        if (err) throw err;
        console.log(result.title_vals.TheHawklineMonster);
    });
    res.render("index.ejs");
});

module.exports = router;