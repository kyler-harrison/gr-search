// example mongo connection 
var mongo = require("mongodb");
var MongoClient = mongo.MongoClient;
var url = "mongodb://localhost:27017/";

MongoClient.connect(url, {useUnifiedTopology: true}, function(err, db) {
  if (err) throw err;
  var dbo = db.db("bookData");
  dbo.collection("wordVals").findOne({word_key: "call"}, (err, result) => {
      if (err) throw err;
      console.log(result.title_vals.FullMoon);
      db.close();
  });
});