//jshint esversion:6
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
// load dotenv
const mongoose = require('mongoose');
const encrypt = require('mongoose-encryption')
const session = require('express-session')
const passport = require("passport")
const passportLocalMongoose = require("passport-local-mongoose")
const GoogleStrategy = require('passport-google-oauth20').Strategy
const findOrCreate = require('mongoose-findorcreate');
const axios = require('axios');
const ObjectId = require('mongodb').ObjectId;
//const fetch = require('node-fetch');

var userDB_id = '';
var userDB_name = '';

function getUserDB_id_google(temp){
    User.find({googleId : temp}, function(err,foundUser){
        if (err) {
            console.log(err);
        } else {
            if (foundUser) {
                console.log("found users")
                console.log(temp)
                console.log(foundUser)
                userDB_id = foundUser[0]._id.toString();
                userDB_name = foundUser[0].username.split(' ')[0];
                console.log("found users")
            }
        }
    })
}



require('dotenv').config();

const app = express();

app.set('view engine', 'ejs');

app.use(session({
    secret: 'Arjun is a good boy',
    resave: false,
    saveUninitialized: false,
  }))

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://audit-framework.herokuapp.com/auth/google/audit",
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id, username: profile.displayName }, function (err, user) {
      console.log(profile)
      getUserDB_id_google(profile.id);
      return cb(err, user);
    });
  }
));

mongoose.connect('mongodb+srv://admin-arjun:auditframework@cluster0.l1hew.mongodb.net/userDB', { useNewUrlParser: true});
//mongoose.set("useCreateIndex")

const userSchema = new mongoose.Schema({
    email: {
        type: String,
    },
    password: {
        type: String,
    },
    googleId: {
        type: String,
    }
});


userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model('User', userSchema);
//mongoose.set("useCreateIndex")

const auditSchema = new mongoose.Schema({
    user_id: {
        type: String,
    },
    user_name: {
        type: String,
    },
    api_type: {
        type: String,
    },
    use_time: {
        type: String,
    },
    time_taken: {
        type: String,
    },
    payload: {
        type: String,
    }
});


auditSchema.plugin(passportLocalMongoose);
auditSchema.plugin(findOrCreate);

const Audit = new mongoose.model('Audit', auditSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
passport.deserializeUser(function(id, done) {
User.findById(id, function(err, user) {
    done(err, user);
});
});
  

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

app.get("/", function (req, res) {
    res.render("home");
});

app.get("/login", function(req, res) {
    res.render("login")
})

app.get("/register", function(req, res) {
    res.render("register")
})

app.get("/root", function(req, res) {
    if(userDB_name == 'root'){
        Audit.find({}, function(err,foundAudit){
            if (err) {
                console.log(err);
            } else {
                if (foundAudit) {
                    var apiCount={"Add":0,"Delete":0,"Search":0,"Show":0,"Total":0};
                    foundAudit.forEach(function(audit){
                        if(audit["api_type"] == "Add"){
                            apiCount["Add"] += 1;
                        }
                        else if(audit["api_type"] == "Delete"){
                            apiCount["Delete"] += 1;
                        }
                        else if(audit["api_type"] == "Search"){
                            apiCount["Search"] += 1;
                        }
                        else if(audit["api_type"] == "Show"){
                            apiCount["Show"] += 1;
                        }
                        apiCount["Total"] += 1;
                    })
                    // console.log("----------------")
                    // console.log(foundAudit)
                    res.render("root", { AuditLogs: foundAudit, userDB_name: userDB_name, apiCount: apiCount});
                    //console.log("found users")
                }
            }
        })
    }
    else{
        res.redirect("/");
    }
})

app.get("/apiList", function (req, res) {
    console.log("Logged in user: " + userDB_name)
    console.log(userDB_id)
    res.render("apiList", {userDB_name: userDB_name});
});

app.post("/search_stock", function (req, res) {

    var start = new Date();
    axios
    .get("http://enigmaapp-env-1.eba-5fsstvxk.ap-south-1.elasticbeanstalk.com/stocks/" + req.body.stock_name)
    .then(function (response) {
        console.log(response.data);
        res.render("show_stocks", { all_stocks: [response.data], userDB_name: userDB_name,  check: "search"})
    }
    )
    .catch(function (error) {
        console.log(error);
    }
    );  
    var end = new Date();
    var time = end - start;
    var payload = {"name": req.body.stock_name};
    console.log(time);
    var audit = new Audit({
        user_id: userDB_id,
        user_name: userDB_name,
        api_type: "Search",
        use_time: start,
        time_taken: time,
        payload: JSON.stringify(payload)
    })
    audit.save();
});

app.post("/delete_stock", function (req, res) {

    var start = new Date();
    axios
    .delete("http://enigmaapp-env-1.eba-5fsstvxk.ap-south-1.elasticbeanstalk.com/stocks/" + req.body.stock_name)
    .then(function (response) {
        console.log(response.data);
        res.render("show_stocks", { all_stocks: [response.data] , userDB_name: userDB_name, check: "delete"})
    }
    )
    .catch(function (error) {
        console.log(error);
    }
    );  
    var end = new Date();
    var time = end - start;
    var payload = {"name": req.body.stock_name};
    console.log(time);
    var audit = new Audit({
        user_id: userDB_id,
        user_name: userDB_name,
        api_type: "Delete",
        use_time: start,
        time_taken: time,
        payload: JSON.stringify(payload)
    })
    audit.save();
});

app.get("/all_stocks", function (req, res) {
    var start = new Date();
    axios
    .get("http://enigmaapp-env-1.eba-5fsstvxk.ap-south-1.elasticbeanstalk.com/stocks/")
    .then(function (response) {
        console.log(response.data);
        res.render("show_stocks", { all_stocks: response.data, userDB_name: userDB_name, check: "show"});
    }
    )
    .catch(function (error) {
        console.log(error);
    }
    );
    var payload = "-";
    var end = new Date();
    var time = end - start;
    console.log(time);
    var audit = new Audit({
        user_id: userDB_id,
        user_name: userDB_name,
        api_type: "Show",
        use_time: start,
        time_taken: time,
        payload: payload
    })
    audit.save();
})

// app.get("/check",function(req,res){
//     axios
//     .get("http://localhost:8080/stocks/")
//     .then(function (response) {
//         console.log("------------------------------------check------------------------------------------");
//         console.log(response.data[response.data.length-1].id);
//         console.log(response.data[response.data.length-1].id+1);
//         //res.render("show_stocks", { all_stocks: response.data, userDB_name: userDB_name });
//         console.log("------------------------------------check------------------------------------------");
//     })

// });

app.post("/api_add", function (req, res) {
    var stock_name=req.body.stockName;
    var stock_price=req.body.stockPrice;
    var stock_quantity=req.body.stockQuantity;
    var stock_type=req.body.stockType;
    var start = new Date();
    var stock ={"name":stock_name, "type":stock_type, "price":stock_price, "values":stock_quantity};
    axios.post('http://enigmaapp-env-1.eba-5fsstvxk.ap-south-1.elasticbeanstalk.com/stocks/', stock)
    .then(function (response) {
        console.log(response.data);  
    }
    )
    .catch(function (error) {
        console.log(error);
    }
    );
    var end = new Date();
    var time = end - start;
    console.log(time);
    var audit = new Audit({
        user_id: userDB_id,
        user_name: userDB_name,
        api_type: "Add",
        use_time: start,
        time_taken: time,
        payload: JSON.stringify(stock)
    })
    audit.save();
    res.redirect("/apiList");
})
    
app.post("/api_update", function (req, res) {
    var stock_id=req.body.stockId;
    var stock_name=req.body.stockName;
    var stock_price=req.body.stockPrice;
    var stock_quantity=req.body.stockQuantity;
    var stock_type=req.body.stockType;
    var start = new Date();
    var stock ={"id":stock_id, "name":stock_name, "type":stock_type, "price":stock_price, "values":stock_quantity};
    axios.put('http://enigmaapp-env-1.eba-5fsstvxk.ap-south-1.elasticbeanstalk.com/stocks/', stock)
    .then(function (response) {
        console.log(response.data);  
    }
    )
    .catch(function (error) {
        console.log(error);
    }
    );
    var end = new Date();
    var time = end - start;
    console.log(time);
    var audit = new Audit({
        user_id: userDB_id,
        user_name: userDB_name,
        api_type: "Update",
        use_time: start,
        time_taken: time,
        payload: JSON.stringify(stock)
    })
    audit.save();
    res.redirect("/apiList");
})

app.get("/register", function(req, res) {
    res.render("register")
})

app.get("/logout", function(req, res) {
    req.logout()
    res.redirect("/")
})

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/secrets', 
passport.authenticate('google', { failureRedirect: '/login' }),
function(req, res) {
res.redirect('/apiList');
});

app.get("/myLog", function (req, res) {
    Audit.find({user_id: userDB_id}, function(err,foundAudit){
        if (err) {
            console.log(err);
        } else {
            if (foundAudit) {
                var apiCount={"Add":0,"Delete":0,"Search":0,"Show":0,"Total":0};
                foundAudit.forEach(function(audit){
                    if(audit["api_type"] == "Add"){
                        apiCount["Add"] += 1;
                    }
                    else if(audit["api_type"] == "Delete"){
                        apiCount["Delete"] += 1;
                    }
                    else if(audit["api_type"] == "Search"){
                        apiCount["Search"] += 1;
                    }
                    else if(audit["api_type"] == "Show"){
                        apiCount["Show"] += 1;
                    }
                    apiCount["Total"] += 1;
                })
                // console.log("----------------")
                // console.log(foundAudit)
                res.render("myLog", { AuditLogs: foundAudit, userDB_name: userDB_name, apiCount: apiCount});
                console.log("found users")
            }
        
        }
    })
});

app.post("/register", function(req, res){
    //if else
    
    User.register({username: req.body.username}, req.body.password, function(err, user){
        if(err)
        {
            res.send(err)
        }
        else
        {
            passport.authenticate("local")(req,res,function(){
                userDB_id=req.user._id.toString();
                userDB_name=req.user.username.split('@')[0];
                if(userDB_name=="root")
                {
                    res.redirect("/root")
                }
                else{
                    res.redirect("/apiList")
                }
            })
        }
    })
});

app.post("/login", function(req, res){
    
    const user = new User({
        username : req.body.username,
        password : req.body.password
    })
    req.login(user, function(err){
        if(err)
        {
            res.send(err)
        }
        else{
           passport.authenticate("local")(req, res, function(){
            //    loggedInUser(req.user)
            //    console.log("qwerty")
               //console.log(req.user)
               userDB_id=req.user._id.toString();
               userDB_name=req.user.username.split('@')[0];
               if(userDB_name=="root")
               {
                   res.redirect("/root")
               }
               else{
                   res.redirect("/apiList")
               }
               
           }) 
        }
    })
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, () => {
    console.log('Server has started successfully');
});