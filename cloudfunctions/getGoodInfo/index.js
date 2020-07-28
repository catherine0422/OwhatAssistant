// 云函数入口文件
const cloud = require('wx-server-sdk')
const axios = require('axios');
cloud.init()

const db = cloud.database()
const _ = db.command

const url = "https://m.owhat.cn/api";
const NOT_START = 'not start';
const FINISH = 'finish';
const START = 'start';

 
// 云函数入口函数
exports.main = async (event, context) => {
  const responseId = await db.collection('goodId').where({
    isFinish: false
  }).get();
  const goodList = responseId.data;
  for (let good of goodList){
    const id = good.goodId;
    const d = new Date();
    const currentTime = d.getTime();
    let responseInfo = await db.collection('goodInfo').where({
      goodId: id
    }).get()
    if (responseInfo.data.length > 0){
      console.log('已经存储');
      // 已存储在数据库中
      let goodInfo = responseInfo.data[0]; 
      if (currentTime > goodInfo.startTime){
        if (currentTime < goodInfo.endTime){
          // 项目已开始
          let salesInfo = await getSalesInfo(id, currentTime);
          const newCurrentTime = d.getTime();
          await db.collection('goodInfo').where({
            goodId: id,
          }).update({
            data: {
              timeStamp: newCurrentTime,
              salesInfo:_.push(salesInfo)
            }
          })
        }else{
          // 项目已结束
          let salesInfo = await getSalesInfo(id, goodInfo.endTime);
          await db.collection('goodInfo').where({
            goodId: id,
          }).update({
            data: {
              status: FINISH,
              salesInfo: _.push(salesInfo)
            }
          })
          await db.collection('goodId').where({
            goodId: id
          }).update({
            data:{
              isFinish: true
            }
          })
        }
        
      }
    } else {
      // 初次存储
      console.log('初次存储');
      let goodInfo = await getGoodInfo(id, currentTime); 
      if (good.aim){
        goodInfo.aim = good.aim;
      }
      const newCurrentTime = d.getTime();
      goodInfo.timeStamp = newCurrentTime;
      await db.collection('goodInfo').add({
        data: goodInfo
      })
      if (goodInfo.status == FINISH){
        await db.collection('goodId').where({
          goodId: id
        }).update({
          data:{
            isFinish: true
          }
        })
      }
    }
  }
}

async function getGoodInfo(id, currentTime) {
  try {
    let goodInfo = await getGoodIntro(id);
    if (goodInfo.endTime < currentTime) {
      goodInfo.status = FINISH;
      goodInfo.salesInfo = [];
      goodInfo.salesInfo[0] = await getSalesInfo(id, currentTime);
    } else if (goodInfo.startTime > currentTime) {
      goodInfo.status = NOT_START;
    } else {
      goodInfo.status = START;
      goodInfo.salesInfo = [];
      goodInfo.salesInfo[0] = await getSalesInfo(id, currentTime);
    }
    console.log('goodInfo', goodInfo);
    return goodInfo;
  } catch (e) {
    console.log(e)
  }
}

async function getGoodIntro(id) {
  try {
    const params = {
      "apiv": '1.0.0',
      "client": { "platform": "ios", "deviceid": "294311C1-01D2-48B9-8AB0-43FDC0DF9555", "channel": "AppStore", "version": "5.5.0" },
      "cmd_m": 'findgoodsbyid',
      "cmd_s": 'shop.goods',
      "data": { 'goodsid': id },
      "requesttimestap": '1589462094.939032',
      "v": '1.0'
    };
    const options = {
      method: 'POST',
      url,
      params
    }
    const res = await axios(options);
    const data = res.data.data;
    let goodIntro = {
      title: data.title,
      star: data.starlist.map(star => star.nickname),
      startTime: data.salestartat,
      endTime: data.saleendat,
      goodId: id,
    }
    console.log('GoodIntro:', goodIntro);
    return goodIntro;
  } catch (e) {
    console.log(e);
  }
}

async function getSalesInfo(id, currentTime) {
  let items = await getSalesItems(id);
  let page = 1;
  let userCount = 0;
  let money = 0;
  console.log('Count:');
  while (true) {
    let userInfos = await getCount(id, page);
    userCount += userInfos.count;
    money += userInfos.money;
    if (userInfos.count < 100) {
      break;
    }
    page++;
  }
  let salesInfo = {
    userCount,
    money: money.toFixed(2), //两位小数
    items,
    time: currentTime
  }
  console.log('salesInfo', salesInfo);
  return salesInfo;
}

async function getCount(id, page) {
  try {
    console.log('第' + page + '页数据');
    let money = 0;
    const params = {
      "apiv": '1.0.0',
      "client": { "platform": "ios", "deviceid": "294311C1-01D2-48B9-8AB0-43FDC0DF9555", "channel": "AppStore", "version": "5.5.0" },
      "cmd_m": 'findrankingbygoodsid',
      "cmd_s": 'shop.goods',
      "data": { "goodsid": id, "pagenum": page, "pagesize": "100" },
      "requesttimestap": '1589461440.770119',
      "v": '1.0'
    };
    const options = {
      method: 'POST',
      url,
      params
    }
    const res = await axios(options);
    const data = res.data.data.rankinglist;
    for (let user of data) {
      money += parseFloat(user.amount);
    }
    return {
      count: data.length,
      money
    };
  } catch (e) {
    console.log(e);
  }
}

async function getSalesItems(id) {
  try {
    const params = {
      "apiv": '1.0.0',
      "client": { "platform": "ios", "deviceid": "294311C1-01D2-48B9-8AB0-43FDC0DF9555", "channel": "AppStore", "version": "5.5.0" },
      "cmd_m": 'findPricesAndStock',
      "cmd_s": 'shop.price',
      "data": { "fk_goods_id": id },
      "requesttimestap": '1589461440.770119',
      "v": '1.5.6L'
    };
    const options = {
      method: 'POST',
      url,
      params
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
    console.log('items:', salesItems);
    return salesItems;
  } catch (e) {
    console.log(e);
  }
}

