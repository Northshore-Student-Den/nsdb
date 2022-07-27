'use strict';

process.env.TZ = 'America/Los Angeles'; 

require('dotenv').config();

const Discord   = require('discord.js'),
      http      = require('http'),
      fs        = require('fs'),
      url       = require('url'),
      schedule  = require('node-schedule'),
      moment    = require('moment'),
      plotly    = require('plotly')(process.env.PLOTLY_USERNAME, process.env.PLOTLY_APIKEY),
      splitargs = require('splitargs');

const client = new Discord.Client();

let commandPrefix = 'n!';
let msInDay = 24 * 60 * 60 * 1000;
let timestamps = [], memberCounts = [];

/////////////////////////////////////////////////

function getCurrTimestamp(){
    return moment().format('YYYY-MM-DD HH:mm:ss');
}

function log(msg){
    const output = getCurrTimestamp()
        + " / "
        + timestamps.length
        + " / "
        + msg;
    console.log(output);
    fs.appendFile('log.txt', output + '\n', err => {
        if(err) console.log(err);
    });
}

function dlog(msg){
    getNumOnlineMembers((nsdd, _) => {
        nsdd
            .channels.cache
            .get('808039765060223056')
            .send(getCurrTimestamp() + ": " + msg);
    });
}

function getNumOnlineMembers(callback){
    try {
        let nsdd = client.guilds.cache.get('769222562621292585');
        nsdd
            .members.fetch()
            .then(fetchedMembers => {
                let onlineMemberList = fetchedMembers
                    .filter(member =>
                        member.presence.status !== 'offline'
                        && !member.user.bot
                    );
                callback(nsdd, onlineMemberList.size);
        });
    } catch {
        log("FAILED TO FETCH member count data.");
    }
}

/////////////////////////////////////////////////

client.once('ready', () => {
    log(`STARTED; Invite link: https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot`);
    dlog('start');
});

client.on('message', message => {

    if(message.content === `<@!${client.user.id}>`){
        getNumOnlineMembers((nsdd, memberCount) => {
            message.channel.send(`${memberCount} people online`);
        });
    }

    if(!message.author.bot
       && message.content.startsWith(commandPrefix)
       //&& message.
       //    .has(Discord.Permissions.FLAGS.BAN_MEMBERS)
    ){
        const args = splitargs(message.content);

        switch(args[0].substr(commandPrefix.length)){

            case 'say':
                getNumOnlineMembers((nsdd, _) => {
                    nsdd.channels.cache.get(args[1]).send(args[2]);
                });
                break;

            default:
                message.channel.send('Unrecognized command');
        }
    }

});

client.login(process.env.DISCORD_TOKEN);

/////////////////////////////////////////////////

schedule.scheduleJob('0 */5 * * * *', () => {

    try {
        getNumOnlineMembers((nsdguild, memberCount) => {

            nsdguild
                .channels.cache
                .get('770388602488094740')
                .setTopic(`Chat with other members of the server! There are ${memberCount} people currently online.`);

            timestamps.push(getCurrTimestamp());
            memberCounts.push(memberCount);

            log("RECORDED member count data.");
            dlog("recd " + timestamps.length);

            if(timestamps.length >= 3){
                try {
                    plotly.plot(
                        [
                            {
                                x: timestamps,
                                y: memberCounts,
                                type: 'line'
                            }
                        ],
                        {
                            layout: {
                                title: "Northshore Student Den: online member count",
                                xaxis: {
                                    title: "Date and time (UTC)"
                                },
                                yaxis: {
                                    title: "Number of online members"
                                }
                            },
                            filename: 'Northshore Student Den member count',
                            fileopt: 'extend'
                        },
                        (err, msg) => {

                            console.log(msg);

                            if(err){
                                console.error(err);

                                if(timestamps.length > 720){
                                    timestamps.length = 0;
                                    memberCounts.length = 0;

                                    log("DELETED member count data after a full hour of unsuccessful upload attempts. TIMESTAMPS ", timestamps, " MEMBERCOUNTS ", memberCounts);
                                    dlog('del' + timestamps.length);
                                } else {
                                    log("FAILED TO UPLOAD member count data.");
                                    dlog('fupl' + timestamps.length);
                                }

                            } else {
                                timestamps.length = 0;
                                memberCounts.length = 0;

                                log("UPLOADED member count data.");
                                dlog('upl ' + timestamps.length);
                            }
                        }
                    );
                } catch(SyntaxError){
                    console.log("???");
                    dlog('snx ' + timestamps.length);
                }
            }
        });
    } catch (err){
        log(`FAILED TO RECORD member count data: ${err}`);
        dlog('frcd' + timestamps.length);
    }
});

/////////////////////////////////////////////////

http.createServer((req, res) => {

    try {
        const query = url.parse(req.url, true);

        res.setHeader("Content-Type", "text/html");
        res.writeHead(200);

        if(query.pathname === '/log'){
            fs.readFile('log.txt', 'utf8', (err, data) => {
                if(err) return console.error(err);
                res.write('<style> p { white-space: pre-wrap; font-family: monospace; } </style>');
                res.write('<meta http-equiv="refresh" content="5">\n');
                res.write('<p>' + data.toString() + '<p>');
                res.end();
            });
        } else {
            res.write(`Hello World!`);
            res.end();
        }
    } catch(err){
        log(`FAILED TO RUN HTTP SERVER: ${err}`);
    }

}).listen(8080);
