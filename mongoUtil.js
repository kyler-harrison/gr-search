const MongoClient = require("mongodb").MongoClient;
const url = "mongodb://localhost:" + process.env.MONGO_URI + "/";
const dbName = "bookData";
var _db;

// define initial connection to mongo and subsequent db objects after connected 
module.exports = {
    connectToServer: async (callback) => {
        await MongoClient.connect(url, {useUnifiedTopology: true}, (err, client) => {
            _db = client.db(dbName);
            return callback(err);
        });
    },
    getDb: () => {
        return _db;
    }
};