// 云函数入口文件
const cloud = require('wx-server-sdk')
const axios = require('axios');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

const url = "http://appo4.owhat.cn/api";
const NOT_START = 'not start';
const FINISH = 'finish';
const START = 'start';

const SCOLE = 160;

const headers = { 'Host': 'appo4.owhat.cn',
'Content-Type': 'application/x-www-form-urlencoded',
'Connection': 'keep-alive',
'Accept': '*/*',
'User-Agent': 'Owhat/5.5.0 (iPhone; iOS 11.4; Scale/3.00)',
'Accept-Language': 'zh-Hans-CN;q=1, fr-CN;q=0.9, ko-KR;q=0.8, io-CN;q=0.7, fr-CA;q=0.6',
'Accept-Encoding': 'gzip, deflate'}

 
// 云函数入口函数
exports.main = async (event, context) => {
  let {id, index, count} = event;
  // 以2万为界，超过则分批读取
  count.money = parseFloat(count.money);
  console.log('读取id：', id);
  console.log('第几个2万', index);
  try{
    let newCount = await getCount(id, index, count);
    console.log('count', newCount);
    onQuery = !newCount.isFinish;
    let salesRes = await getSalesItems(id);
    console.log('items:', salesRes.salesItems);
    if (newCount.isFinish){
      await db.collection('goodDb').doc(id).update({
        data: {
          userClass: newCount.userClass,
          userCount: newCount.userCount,
          average: newCount.average,
          onQuery,
          salesItems: salesRes.salesItems,
          money: salesRes.money,
        }
      });
    } else{
      // 大于200页，分批读取
      cloud.callFunction({
        name:'getGoodInfoPage',
        data:{
          index:index + 1,
          id:id,
          count:newCount,
        }
      })
    }
    return {
      event
    }
  }catch(error){
    // 项目不存在，删除
    console.log('错误日志：', error);
    await db.collection('goodDb').doc(id).remove();
  }

}

async function getCount(id, index, count) {
    // 从201页开始读取
    let page = index*SCOLE + 1;
    let userCount = count.userCount;
    let userClass = count.userClass;
    let money = count.money;
    isFinish = true;
    while (true) {
      let countPage = await getCountPage(id, page);
      userCount += countPage.count;
      money += countPage.money;
      for (let key of Object.keys(userClass)){
        userClass[key] += countPage.userClass[key];
      }
      if (countPage.count < 100) {
        break;
      }
      if (page - index*SCOLE >= SCOLE){
        // 大于200页
        isFinish = false;
        break;
      }
      page++;
    }
    let dataCount = {
      userClass,
      userCount,
      money: money.toFixed(2),
      average: (money/userCount).toFixed(2),
      isFinish:true
    }
    if(!isFinish){
      dataCount.isFinish = false;
    }
    return dataCount;
}

async function getCountPage(id, page){
  console.log('第' + page + '页数据');
  const params = {
    "client": { "platform": "ios", "deviceid": "294311C1-01D2-48B9-8AB0-43FDC0DF9555", "channel": "AppStore", "version": "5.5.0" },
    "cmd_m": 'findrankingbygoodsid',
    "cmd_s": 'shop.goods',
    "data": { "goodsid": id, "pagenum": page, "pagesize": "100" },
    "v": '1.6.21L'
  };
  const options = {
    method: 'POST',
    url,
    params,
    headers
  }
  const resCount = await axios(options);
  const data = resCount.data.data.rankinglist;
  let money = 0;
  let userClass = {
    cThreeThousand: 0,
    cThousand: 0,
    cThreeHundred: 0,
    cHundred: 0,
    cFifty: 0,
    cTwenty: 0,
    cZero: 0
  }
  for (let user of data) {
    let amount = parseFloat(user.amount)
    money += amount;
    if (amount >= 3000){
      userClass.cThreeThousand++;
    }else if (amount >= 1000){
      userClass.cThousand++;
    }else if (amount >= 300){
      userClass.cThreeHundred++;
    }else if (amount >= 100){
      userClass.cHundred++;
    }else if (amount >= 50){
      userClass.cFifty++;
    }else if (amount >= 20){
      userClass.cTwenty++;
    }else{
      userClass.cZero++;
    }
  }
  return {
    count: data.length,
    money,
    userClass
  }
}

async function getSalesItems(id) {
    const params = {
      "client": { "platform": "ios", "deviceid": "294311C1-01D2-48B9-8AB0-43FDC0DF9555", "channel": "AppStore", "version": "5.5.0" },
      "cmd_m": 'findPricesAndStock',
      "cmd_s": 'shop.price',
      "data": { "fk_goods_id": id },
      "v": '1.6.21L'
    };
    const options = {
      method: 'POST',
      url,
      params,
      headers
    }
    const res = await axios(options);
    const data = res.data.data.prices;
    const salesItems = [];
    for (let item of data) {
      salesItems.push({
        name: item.name,
        price: item.pricestr,
        saleStock: item.salestock
      })
    }
    return salesItems;
}

function getLocalTime(nS) {
  let time = new Date(parseInt(nS));
  let months = time.getMonth() + 1;
  let days = time.getDate();
  let hours = time.getUTCHours() + 8;
  if (hours >= 24){
    hours = hours - 24;
    days = days + 1;
  } 
  let minutes = time.getMinutes();    
  if (minutes<10){
    minutes = '0'+ minutes;
  }
  return months +'-' + days +' '+ hours + ':' + minutes;
}

function getLocalTimeDiff(start, end){
  let dateDiff = end - start;
  let days = Math.floor(dateDiff / (24 * 3600 * 1000));
  let leave1=dateDiff%(24*3600*1000) 
  let hours=Math.floor(leave1/(3600*1000))
  let leave2=leave1%(3600*1000) 
  let minutes=Math.floor(leave2/(60*1000))
  let timeDiff = '';
  if (days>0){
    timeDiff += days + '天';
  }
  if (hours>0){
    timeDiff += hours + '时';
  }
  if (minutes>0){
    timeDiff += minutes + '钟';
  }
  return timeDiff;
}

async function getSalesItems(id) {
  const params = {
    "client": { "platform": "ios", "deviceid": "294311C1-01D2-48B9-8AB0-43FDC0DF9555", "channel": "AppStore", "version": "5.5.0" },
    "cmd_m": 'findPricesAndStock',
    "cmd_s": 'shop.price',
    "data": { "fk_goods_id": id },
    "v": '1.6.21L'
  };
  const options = {
    method: 'POST',
    url,
    params,
    headers
  }
  const res = await axios(options);
  const data = res.data.data.prices;
  const salesItems = [];
  var money = 0;
  for (let item of data) {
    salesItems.push({
      name: item.name,
      price: item.pricestr,
      saleStock: item.salestock
    })
    money += item.salestock * item.price
  }
  return {
    salesItems,
    money: (money).toFixed(2)
  };
}