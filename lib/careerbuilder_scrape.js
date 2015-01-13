var request = require('request'),
    fs = require('fs'),
    parseString = require('xml2js').parseString,
    async = require('async'),
    htmlToText = require('html-to-text')
    sanitizeHtml = require('sanitize-html'),
    xl = require('excel4node');

module.exports = function(config, doneCareerBuilderScrape) {
  var jobInfosArr = [];

  var reqOptions = {
      method: 'GET',
      uri: 'http://api.careerbuilder.com/v1/jobsearch',
      useQuerystring: true,
      qs: {
        DeveloperKey: config.developer,
        CountryCode: 'US',
        EmpType: 'JTFT',
        ExcludeNational: true,
        ExcludeNonTraditionalJobs: true,
        Location: config.zipcode.toString(),
        PostedWithin: 30,
        Radius: config.radius,
        Keywords: config.keywords,
        UseFacets: true,
        FacetCity: 'New York',
        PageNumber: 1
      }
    };

  var lastItemIndex = 0,
      totalCount = 10000;

  var keepScraping = function() {
    return lastItemIndex < totalCount;
  };

  var getJobInfos = function(doneGetJobInfos) {
    request(reqOptions, function(err, message, body) {
      parseString(body, function(err, parsed) {
        lastItemIndex = parsed.ResponseJobSearch.LastItemIndex[0];
        totalCount = parsed.ResponseJobSearch.TotalCount[0];

        var result = parsed.ResponseJobSearch.Results[0].JobSearchResult;

        var getOneJobContent = function(oneJobPost, doneGetOneJobPost) {
          var oneReqOptions = {
            method: 'GET',
            uri: 'http://api.careerbuilder.com/v1/job',
            useQuerystring: true,
            qs: {
              DeveloperKey: config.developer,
              DID: oneJobPost.DID[0]
            }
          };

          request(oneReqOptions, function(err, message, body) {
            parseString(body, function(err, parsed) {
              jobInfosArr.push(parsed);
              doneGetOneJobPost(err);
            });
          });
        };

        async.each(result, getOneJobContent, function(err) {
          reqOptions.qs.PageNumber++;
          doneGetJobInfos(err);
        });
      });
    });
  };

  var createExcel = function(err) {
    var filteredJobInfosArr = jobInfosArr.map(function(jobInfo) {
      var jobDetail = jobInfo.ResponseJob.Job[0];
      var filteredJobInfo = {
        "Job Title": jobDetail.JobTitle[0],
        "Company": jobDetail.Company[0],
        "Date": jobDetail.BeginDate[0],
        "Categories": jobDetail.Categories[0],
        "Degree Required": jobDetail.DegreeRequired[0],
        "Experience Required": jobDetail.ExperienceRequired[0],
        "Job Description": htmlToText.fromString(htmlToText.fromString(jobDetail.JobDescription[0])),
        "Job Requirements": htmlToText.fromString(htmlToText.fromString(jobDetail.JobRequirements[0])),
        "Salary From": jobDetail.PayLow[0].Money[0].FormattedAmount[0],
        "Salary To": jobDetail.PayHigh[0].Money[0].FormattedAmount[0],
        "Contact Info Name": jobDetail.ContactInfoName[0],
        "Contact Info Phone": jobDetail.ContactInfoPhone[0],
        "Apply Link": jobDetail.ContactInfoEmailURL[0]
      };

      return filteredJobInfo;
    });

    var wb = new xl.WorkBook();
    var ws = wb.WorkSheet('New Worksheet');

    // Global Styles
    ws.Row(1).Height(50);
    ws.Column(1).Width(25);
    ws.Column(2).Width(25);
    ws.Column(3).Width(15);
    ws.Column(4).Width(20);
    ws.Column(5).Width(20);
    ws.Column(6).Width(20);
    ws.Column(7).Width(50);
    ws.Column(8).Width(50);
    ws.Column(9).Width(15);
    ws.Column(10).Width(15);
    ws.Column(11).Width(15);
    ws.Column(12).Width(15);
    ws.Column(13).Width(15);

    // Title Styles
    var titleStyle = wb.Style();
    titleStyle.Font.Bold();
    titleStyle.Font.Size(20);
    titleStyle.Font.Alignment.Vertical('center');
    titleStyle.Font.Alignment.Horizontal('center');
    titleStyle.Font.WrapText(true);

    // Title Data
    var titles = Object.keys(filteredJobInfosArr[0]);

    for (var i = 0; i < titles.length; i++) {
      ws.Cell(1, i + 1).String(titles[i]).Style(titleStyle);
    }

    // Content Styles
    var contentStyle = wb.Style();
    contentStyle.Font.WrapText(true);
    contentStyle.Font.Alignment.Vertical('top');

    // Content Data
    for (var j = 0; j < filteredJobInfosArr.length; j++) {
      var contents = Object.keys(filteredJobInfosArr[j]);
      for (var k = 0; k < contents.length; k++) {
        ws.Cell(j + 2, k + 1).String(filteredJobInfosArr[j][contents[k]]).Style(contentStyle);
      }
    }

    wb.write("job_search_careerbuilder.xlsx",function(err){
      console.log('success scraping Career Builder');
      doneCareerBuilderScrape(err);
    });
  };

  async.whilst(keepScraping, getJobInfos, createExcel);
};