const express = require("express");
const router = express.Router();
const mongoUtil = require("../mongoUtil.js");
const db = mongoUtil.getDb();
const collection = "wordVals";

router.get("/", (req, res) => {
    res.render("index.ejs");
});

db.collection(collection).findOne({word_key: "call"}, (err, result) => {
    if (err) throw err;
    console.log(result.title_vals.TheHawklineMonster);
});

module.exports = router;