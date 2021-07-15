// mongodb configuration, allows one connect and multiple uses across other files, code from: https://branche.online/mongodb-with-promises/
const mongoDriver = require("mongodb");
const uri = "mongodb://localhost:" + process.env.MONGO_URI + "/";
const dbName = "bookData";

var database = {};
var dbClient = mongoDriver.MongoClient(uri, {useUnifiedTopology: true, useNewUrlParser: true});
var dbo = false;

database.getObjectId = (id) => {
    return mongoDriver.ObjectID(id);
}

database.connect = () => {
    return new Promise(async (resolve, reject) => {
        try {
            await dbClient.connect();
            dbo = dbClient.db(dbName);
            if (!dbo) throw new Error("unable to connect to db"); else resolve(dbo);
        } catch(e) {
            reject(e);
        }
    });
}

database.get = () => dbo;

database.close = () => {
    return new Promise(async (resolve, reject) => {
        try {
            await dbClient.close();
            resolve();
        } catch(e) {
            reject(e);
        }
    });
}

module.exports = database;
