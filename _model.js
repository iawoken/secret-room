const { Schema, model } = require("mongoose");

const schema = new Schema({
    Id: String,
    Owner: String,
    Name: String,
    Password: String,
    Users: Array,
    Duration: Number,
    LastJoin: Number,
    MaxUser: Number
})

module.exports = model("CustomRoom", schema);