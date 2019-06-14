#! /usr/bin/env node
const puppeteer = require('puppeteer');
const schedule = require('node-schedule');
const fs = require('fs');
const cmd = require('node-cmd');
const ping = require('ping');

/* 常量区 */
const shadowsocksName = 'Shadowsocks.exe';
const workPath = 'E:/BaiduNetdiskDownload/Shadowsocks-4.1.6';

const argv = require('yargs')
    .command('refresh', '刷新ss账号', function (yargs) {
        let argv = yargs.reset()
            .option('u', {
                alias: 'url',
                demand: true,
                default: 'https://free-ss.ooo/',
                type: 'string',
                description: 'SS站点链接，请填写国内可访问的'
            })
            .alias('h', 'help')
            .argv;

        console.log('开始刷新ss账号...');
        parse(argv.u).then(ssArr => {
            console.log('抓取到 ' + ssArr.length + '个账号');
            persistSS(ssArr);

            restart();
        });

    }).command('cron', '设置cron定时任务，刷新ss账号', function (yargs) {
        let argv = yargs.reset()
            .option('u', {
                alias: 'url',
                demand: true,
                default: 'https://free-ss.ooo/',
                type: 'string',
                description: 'SS站点链接，请填写国内可访问的'
            })
            .option('c', {
                alias: 'cron',
                demand: true,
                default: '0 0 0/1 * * ? ',
                type: 'string',
                description: 'cron表达式，默认为每小时执行一次'
            })
            .help('h')
            .alias('h', 'help')
            .argv;

        console.log('开始定时刷新ss账号...');
        const scheduleCronStyle = () => {
            //每分钟的第30秒定时执行一次:
            schedule.scheduleJob(argv.c, () => {
                parse(argv.u)
                    .then(ssArr => {
                        console.log('抓取到 ' + ssArr.length + '个账号');
                        persistSS(ssArr);

                        restart();
                    });
            });
        };

        scheduleCronStyle();

        console.log('定时任务设置成功...')

    })
    .alias('h', 'help')
    .argv;

/**
 * 使用无头chrome 渲染抓取数据，结构化输出ss账号信息
 * {
 * address: '197.103.32.62',
 * port: '47974',
 * method: 'chacha20',
 * password: 'S3RjqocJd',
 * region: 'US'
 * }
 * @param url
 */
async function parse(url) {
    const ssArr = [];

    const browser = await puppeteer.launch({
        headless: false,
        devtools: true,
        executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.90 Safari/537.36');
    await page.goto(url, {waitUntil: 'networkidle0'});

    const elementHandles = await page.$$('#tbss > tbody > tr');
    for (const elementHandle of elementHandles) {
        const score = await (await (await elementHandle.$('td:nth-child(1)')).getProperty('innerText')).jsonValue();
        const address = await (await (await elementHandle.$('td:nth-child(2)')).getProperty('innerText')).jsonValue();
        const port = await (await (await elementHandle.$('td:nth-child(3)')).getProperty('innerText')).jsonValue();
        const method = await (await (await elementHandle.$('td:nth-child(4)')).getProperty('innerText')).jsonValue();
        const password = await (await (await elementHandle.$('td:nth-child(5)')).getProperty('innerText')).jsonValue();
        const region = await (await (await elementHandle.$('td:nth-child(7)')).getProperty('innerText')).jsonValue();

        // 测试地址是否可达
        const isAlive = await ping.promise.probe(address);

        if (isAlive) {
            console.log('host ' + address + ' is alive');
            ssArr.push({
                'server': address,
                'server_port': port,
                'remarks': score + '-' + region,
                'method': method,
                'password': password,
                'group': 'auto import by https://github.com/free-auto-ss'
            })
        } else {
            console.log('由于' + address + '不可达，已被丢弃...');
        }
    }

    await browser.close();

    return ssArr;
}

/**
 * 持久化SS信息
 */
function persistSS(ssArr) {
    fs.readFile(workPath + '/gui-config.json', function (err, data) {
        if (err) {
            console.error(err);
        }

        const oldSS = JSON.parse(data.toString());

        oldSS.configs = ssArr;

        const newStr = JSON.stringify(oldSS);

        // 回写到文件
        fs.writeFile(workPath + '/gui-config.json', newStr, function (err) {
            if (err) {
                console.error(err);
            }
            console.log('写入SS信息成功..');
        })
    });
}

/**
 * taskkill /IM "ShadowsocksR.exe" /F
 */
function restart() {
    console.log('准备重启Shadowsocks.exe...');
    cmd.run('taskkill /IM "' + shadowsocksName + '" /F');
    cmd.run('start ' + workPath + '/' + shadowsocksName)
}
