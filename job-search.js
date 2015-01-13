var async = require('async');
var indeedScrape = require('./lib/indeed_scrape.js');
var careerBuilderScrape = require('./lib/careerbuilder_scrape.js');

var scrapingIndeed = function(doneScrapingIndeed) {
  indeedScrape({
    publisher: process.env.INDEED_API,
    keywords: ['assistant+buyer', 'buyer'],
    radius: 5,
    zipcode: 10018
  }, function(err) {
    doneScrapingIndeed(err);
  });
};

var scrapingCareerBuilder = function(doneScrapingCareerBuilder) {
  careerBuilderScrape({
    developer: process.env.CAREER_BUILDER_API,
    keywords: ['assistant buyer'],
    radius: 5,
    zipcode: 10018
  }, function(err) {
    doneScrapingCareerBuilder(err);
  });
};

async.parallel([scrapingIndeed, scrapingCareerBuilder], function(err, results) {
  if (err) throw err;
  console.log("done everything");
});

