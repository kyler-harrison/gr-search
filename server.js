// imports
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const redis = require("redis");
const dotenv = require("dotenv").config();
const rateLimit = require("express-rate-limit");
const database = require("./dbConfig.js");

// settings
const app = express();
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({limit: "10kb", extended: false}));
app.use(session({
	secret: process.env.SESSION_SECRET,
	resave: false,
	saveUninitialized: false,
}));

// connect to mongodb, should be good to use .get() method in other routers
database.connect();

// routers
const indexRouter = require("./routes/index");

// use routers 
app.use("/", indexRouter);

// 404 error on non-existing page
app.use((req, res) => {
	res.send("404 error dude");
});

// using a proxy like nginx, should probably read into this more
//app.set("trust proxy", true);
//app.set("trust proxy", "loopback")

// limit user to 2 requests (all reqs to this server) per second at most (what should this be?)
const limiter = rateLimit({
	windowMs: 1000,
	max: 2,
	message: "hey you dumb fuck", 
		handler: function(req, res) {res.send("no")}
});
app.use(limiter);

// listen on port listed in .env
app.listen(process.env.NODE_PORT)
