import os

content = r'''const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, 'frembogifts.db');

const { open } = sqlite3;
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));'''

with open('server.js', 'w') as f:
    f.write(content)
print('Part 1 written')
