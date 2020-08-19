// miniprogram/pages/search/index.js
import {request} from "../../request/index";
import {URL, HEADER_GOODINTRO, CLIENT_INFO} from "../search/cst";
const FINISH = 'finish';
const START = 'start';
const NOT_START = 'not start';
const db = wx.cloud.database()
const _ = db.command
Page({

  /**
   * 页面的初始数据
   */
  data: {
    btnDisable: false,
    goodId: '',
    startTime: '',
    endTime: '',
    localTime: {
      startTime: '',
      endTime: '',
      duration: ''
    },
    salesItems: [    ],
    money: '',
    userCount: '',
    average: '',
    userClass: {
      cThreeThousand: '',
      cThousand: '',
      cThreeHundred: '',
      cHundred: '',
      cFifty: '',
      cTwenty: '',
      cZero: ''
    },
    star: '',
    title: '',
    fanClub: '',
    status: '',
    log: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: async function (options) {
    this.getLocalTime(1596022260000);
  },

  async formSubmit(e) {
    const goodId = parseInt(e.detail.value.goodId);
    if (!goodId){
      wx.showToast({
        title: '请输入项目ID',
        icon: "none"
      })
    }else{
      this.setData({
        btnDisable: true
      })
      wx.showLoading({
        title: '搜索中',
      })
      const resGoodDb = await db.collection('goodDb').where({
        goodId:goodId,
        status: FINISH
      }).get();
      const goodDb = resGoodDb.data[0];
      if (goodDb){
        wx.hideLoading();
        this.setData({
          btnDisable: false,
          goodId: goodDb.goodId,
          startTime: goodDb.startTime,
          endTime: goodDb.endTime,
          localTime: goodDb.localTime,
          salesItems: goodDb.salesItems,
          money: goodDb.money,
          userCount: goodDb.userCount,
          average: goodDb.average,
          userClass: goodDb.userClass,
          star: goodDb.star,
          title: goodDb.title,
          fanClub: goodDb.fanClub,
          status: goodDb.status
        })
        const d = new Date();
        const currentTime = d.getTime();
        await db.collection('goodSearchHistory').add({
          data: {
            goodId:this.data.goodId,
            timestamp: this.getLocalTime(currentTime),
            title: this.data.title,
            star: this.data.star,
            money: this.data.money,
          }
        });
      }else{
        wx.hideLoading();
        wx.showToast({
          title: '数据库中未存储或项目未结束，开始读取',
          icon: "none"
        });
        await this.getGoodInfo(goodId);
      }
    }
  },

  async getGoodInfo(id){
    wx.showLoading({
      mask:false,
    })
    await this.getGoodIntro(id);
    await this.getSalesItems(id);
    await this.getCount(id);
    wx.showToast({
      title: '读取完毕'
    })
    this.setData({
      log: []
    })
    if (this.data.status == FINISH){
      await db.collection('goodDb').add({
        data: this.data
      });
    }
    const d = new Date();
    const currentTime = d.getTime();
    await db.collection('goodSearchHistory').add({
      data: {
        goodId:this.data.goodId,
        timestamp: this.getLocalTime(currentTime),
        title: this.data.title,
        star: this.data.star,
        money: this.data.money,
      }
    });
    this.setData({
      btnDisable: false
    })
    wx.hideLoading()
  },

  async getGoodIntro(id){
    try{
      let log = this.data.log;
      log.push('读取项目简介；');
      this.setData({
        log
      })
      let resGoodIntro = await request({
        url: URL,
        header: HEADER_GOODINTRO,
        method: 'POST',
        data: {
          "client": CLIENT_INFO,
          "cmd_m": 'findgoodsbyid',
          "cmd_s": 'shop.goods',
          "data": '{ "goodsid": '+ id +' }',
          "v": '1.5.6L'
        }
      })
      let goodIntro = resGoodIntro.data.data;
      const d = new Date();
      const currentTime = d.getTime();
      let status = '';
      if (currentTime < goodIntro.salestartat){
        status = NOT_START;
      } else if (currentTime > goodIntro.saleendat){
        status = FINISH;
      }else{
        status = START;
      }
      let star = '';
      for (let goodStar of goodIntro.starlist){
        star += goodStar.nickname;
      }
      let localTime = {
        startTime: this.getLocalTime(goodIntro.salestartat),
        endTime: this.getLocalTime(goodIntro.saleendat),
        duration: this.getLocalTimeDiff(goodIntro.salestartat, goodIntro.saleendat),
      }
      this.setData({
        goodId: goodIntro.goodsid,
        startTime: goodIntro.salestartat,
        endTime: goodIntro.saleendat,
        star: goodIntro.starList,
        title: goodIntro.title,
        fanClub: goodIntro.owner.nickname,
        status,
        star,
        localTime
      })
    }catch (e){
      console.log(e);
    }
  },

  async getSalesItems(id) {
    try {
      let log = this.data.log;
      log.push('读取项目商品信息；');
      this.setData({
        log
      })
      let resSalesItems = await request({
        url: URL,
        header: HEADER_GOODINTRO,
        method: 'POST',
        data: {
          "client": CLIENT_INFO,
          "cmd_m": 'findPricesAndStock',
          "cmd_s": 'shop.price',
          "data": '{ "fk_goods_id": '+ id +' }',
          "v": '1.5.6L'
        }
      })
      const data = resSalesItems.data.data.prices;
      const salesItems = [];
      for (let item of data) {
        salesItems.push({
          name: item.name,
          price: item.pricestr,
          saleStock: item.salestock
        })
      }
      this.setData({
        salesItems
      })
    } catch (e) {
      console.log(e);
    }
  },

  async getCount(id, currentTime) {
    try{
      let log = this.data.log;
      log.push('读取排名信息（一页100人）:');
      this.setData({
        log
      })
      let page = 1;
      let userCount = 0;
      let userClass = {
        cThreeThousand: 0,
        cThousand: 0,
        cThreeHundred: 0,
        cHundred: 0,
        cFifty: 0,
        cTwenty: 0,
        cZero: 0
      }
      let money = 0;
      while (true) {
        let countPage = await this.getCountPage(id, page);
        userCount += countPage.count;
        money += countPage.money;
        for (let key of Object.keys(userClass)){
          userClass[key] += countPage.userClass[key];
        }
        if (countPage.count < 100) {
          break;
        }
        page++;
      }
      this.setData({
        userClass,
        userCount,
        money: money.toFixed(2),
        average: (money/userCount).toFixed(2)
      })
    }catch(e){
      console.log(e);
    }
  },

  async getCountPage(id, page) {
    try {
      let log = this.data.log;
      log.push('读取第'+page+'页');
      this.setData({
        log
      })
      let resCount = await request({
        url: URL,
        header: HEADER_GOODINTRO,
        method: 'POST',
        data: {
          "client": CLIENT_INFO,
          "cmd_m": 'findrankingbygoodsid',
          "cmd_s": 'shop.goods',
          "data": '{ "goodsid": '+ id +',"pagenum":'+page+',"pagesize": "100"}',
          "v": '1.5.6L'
        }
      })
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
    } catch (e) {
      console.log(e);
    }
  },

  getLocalTime(nS) {
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
  },

  getLocalTimeDiff(start, end){
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
  },

  question(){
    wx.showModal({
      title:'项目id读取方式',
      content:'在owhat某项目页面中，点击分享，选择复制链接，链接中的id=*******，即为此项目id。',
      showCancel:false
    })
  }

})