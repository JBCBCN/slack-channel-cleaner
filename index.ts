#!/usr/bin/env node
/// <reference path="./typings/index.d.ts" />

var request = require("request");
var inquirer = require("inquirer");
var Async = require("async");
import { List } from 'linqts';

var colors = require('colors');
colors.setTheme({
    input: 'grey',
    prompt: 'cyan',
    info: 'magenta',
    data: 'grey',
    warn: 'yellow',
    debug: 'white',
    error: 'red'
});

var start = false;
var slack = {
    url: 'https://slack.com/api/',
    token: '',
    api: {
        channels_list: 'channels.list',
        channels_history: 'channels.history',
        chat_delete: 'chat.delete'
    }
};

interface IComparer {
    id: string
    name: string
}

var _messageList: Array<any>;
Async.auto({
    getToken: (next, data) => {
        _messageList = [];
        inquirer.prompt([{ message: "Enter your Slack API Token: ", type: "string", name: "token" }]).then(function (answer) {
            if (answer && answer.token) {
                slack.token = answer.token;
                return next(null, answer.token);
            } else {
                console.log(colors.error("Please enter your Slack API Token!!!"));
                return;
            }
        });
    },

    inputs: ['getToken', (next, data) => {
        
        request({ url: slack.url + slack.api.channels_list, qs: { token: slack.token }, timeout: 5000, json: true }, (err, resp, reqData) => {
            if (err || resp.statusCode != 200)
                return err || new Error("Error: " + resp.statusCode);

            if (reqData.ok || reqData.ok == "true") {
                var channels = reqData.channels;
                var channelPrompt = new List<IComparer>(channels).Select(p => ({ name: p.name, id: p.id }));

                inquirer.prompt([{ message: colors.prompt("Delete selected channel records: "), type: "checkbox", name: "list", choices: channelPrompt.ToArray() }]).then(function (s) {
                    console.log(colors.info('Starting......................'));
                    var channelIdList = new List<string>();
                    s.list.forEach(element => {
                        var channel = channelPrompt.First(k => k.name == element);
                        channelIdList.Add(channel.id);
                    });

                    getHistoryMessage(channelIdList.ToArray(), 0);
                });

            } else {
                console.log(colors.error("Error: " + reqData.error));
            }
        });
    }]

});


function getHistoryMessage(data: any, index: number) {

    if (data.length > 0 && (data.length == index)) {
        return;
    }

    var e = data[index];

    request({ url: slack.url + slack.api.channels_history, qs: { token: slack.token, channel: e, count: 1000 }, timeout: 5000, json: true }, (err, resp, reqData) => {

        if (err || resp.statusCode != 200)
            return err || new Error("Error: " + resp.statusCode);

        if (reqData.ok || reqData.ok == "true") {

            var messages = reqData.messages;
            var messageList = new List<any>(messages);

            console.log(colors.debug(" >> Fetching the channel history. ID: " + e + " / Count: " + messageList.Count() + " " + (messageList.Count() == 0 ? "- " + colors.error("Data not available") : "")));

            messageList.ToArray().forEach(k => {
                _messageList.push({ channelId: e, message: k });
            });

            if (messageList.Count() > 0 && !start)
                removeHistoryMessage(0);

            var i = index + 1;
            getHistoryMessage(data, i);

        } else {
            console.log(colors.error("Error: " + reqData.error));
        }

    });
}

function removeHistoryMessage(index: number) {
    if (_messageList.length - 1 == index) {
        console.log(colors.info("Done.........."));
        return;
    }

    start = true;
    var e = _messageList[index];
    request({ url: slack.url + slack.api.chat_delete, qs: { token: slack.token, channel: e.channelId, ts: e.message.ts }, timeout: 5000, json: true }, (err, resp, reqData) => {

        if (err || resp.statusCode != 200)
            return err || new Error("Error: " + resp.statusCode);

        if (reqData.ok || reqData.ok == "true") {
            console.log(colors.data(" >>>> Message deleted. > Message Timestamp: " + e.message.ts + " / Index: " + index + " - Message Count: " + _messageList.length));
            var i = index + 1;
            removeHistoryMessage(i);
        } else {
            console.log(colors.error("Error: " + reqData.error));
        }
    });
}

