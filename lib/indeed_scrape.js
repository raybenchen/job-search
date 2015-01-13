var request = require('request'),
    fs = require('fs'),
    cheerio = require('cheerio'),
    async = require('async'),
    xl = require('excel4node');

module.exports = function(config, doneIndeedScrape) {
  var jobInfosArr = [];

  var reqOptions = {
    method: 'GET',
    uri: 'http://api.indeed.com/ads/apisearch',
    useQuerystring: true,
    qs: {
      v: 2,
      format: 'json',
      st: "",
      jt: "",
      useragent: "Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36",
      userip: "1.2.3.4",
      co: "us",
      chnl: "",
      latlong: "1",
      filter: "1",
      fromage: "",
      start: 0,
      limit: 25,
      publisher: config.publisher,
      l: config.zipcode,
      radius: config.radius,
      q: config.keywords
    }
  };

  var end = 0;
      totalResults = 10000;

  var keepScraping = function() {
    return end < totalResults;
  };

  var getJobInfos = function(doneGetJobInfos) {
    request(reqOptions, function(err, message, body) {
      var body = JSON.parse(body);

      end = body.end;
      totalResults = body.totalResults;

      var results = body.results.map(function(oneResult) {
        var filtered = {
          "Job Title": oneResult.jobtitle,
          "Company": oneResult.company,
          "Date": oneResult.date,
          "Apply Link": oneResult.url
        };

        return filtered;
      });

      var getOneJobContent = function(oneJobPost, doneGetOneJobPost) {
        request(oneJobPost["Apply Link"], function(err, message, body) {
          $ = cheerio.load(body);

          oneJobPost["Job Summary"] = $('#job_summary').text();

          jobInfosArr.push(oneJobPost);
          doneGetOneJobPost(err);
        });
      };

      async.each(results, getOneJobContent, function(err) {
        reqOptions.qs.start += reqOptions.qs.limit;
        doneGetJobInfos(err);
      });
    });
  };

  var createExcel = function(err) {
    var wb = new xl.WorkBook();
    var ws = wb.WorkSheet('New Worksheet');

    // Global Styles
    ws.Row(1).Height(30);
    ws.Column(1).Width(25);
    ws.Column(2).Width(25);
    ws.Column(3).Width(15);
    ws.Column(4).Width(25);
    ws.Column(5).Width(140);

    // Title Styles
    var titleStyle = wb.Style();
    titleStyle.Font.Bold();
    titleStyle.Font.Size(20);
    titleStyle.Font.Alignment.Vertical('center');
    titleStyle.Font.Alignment.Horizontal('center');
    titleStyle.Font.WrapText(true);

    // Title Data
    var titles = Object.keys(jobInfosArr[0]);

    for (var i = 0; i < titles.length; i++) {
      ws.Cell(1, i + 1).String(titles[i]).Style(titleStyle);
    }

    // Content Styles
    var contentStyle = wb.Style();
    contentStyle.Font.WrapText(true);
    contentStyle.Font.Alignment.Vertical('top');

    // Content Data
    for (var j = 0; j < jobInfosArr.length; j++) {
      var contents = Object.keys(jobInfosArr[j]);
      for (var k = 0; k < contents.length; k++) {
        ws.Cell(j + 2, k + 1).String(jobInfosArr[j][contents[k]]).Style(contentStyle);
      }
    }

    wb.write("job_search_indeed.xlsx",function(err){
      console.log('success scraping Indeed');
      doneIndeedScrape(err);
    });
  };

  async.whilst(keepScraping, getJobInfos, createExcel);
};