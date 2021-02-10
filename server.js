// imports
const express = require("express");
const aws = require("aws-sdk");
const bodyParser = require("body-parser");
const session = require("express-session");
const dotenv = require("dotenv").config();
const rateLimit = require("express-rate-limit");
const mongoUtil = require("./mongoUtil.js");

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

// connect to mongo db once
mongoUtil.connectToServer((err, client) => {
	if (err) console.log(err);

	// require routers that use the connection to mongo after this has script has connected, db object in them will be none if don't
	const indexRouter = require("./routes/index");
	// use route that queries db
	app.use("/", indexRouter);
	// 404 error on non-existing page
	app.use((req, res) => {
		res.send("404 error dude");
	});
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
