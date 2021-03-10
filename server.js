// imports
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
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

// using a proxy like nginx, should probably read into this more
//app.set("trust proxy", true);
//app.set("trust proxy", "loopback")
// limit user to 2 requests (all reqs to this server) per second at most 
// NOTE it matters that this is here before routers in script
const limiter = rateLimit({
	windowMs: 1000,
	max: 2,
	handler: (req, res) => {
		console.log("exceeded");
		res.render("rate.ejs");
	}
});
app.use(limiter);

// routers
const indexRouter = require("./routes/index");

// use routers 
app.use("/", indexRouter);

// 404 error on non-existing page
app.use((req, res) => {
	res.render("error404.ejs");
});

// listen on port listed in .env
app.listen(process.env.NODE_PORT)

