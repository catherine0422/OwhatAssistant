// miniprogram/pages/collection/index.js
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
    collection:[]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad (options) {
    this.getCollection();
  },

  onShow(){
    this.getCollection();
  },

  async getCollection(){
    let userCollection = wx.getStorageSync('userCollection');
    if (!userCollection){
      let openid = wx.getStorageSync('openid');
      const resUser = await db.collection('user').where({
        _openid: openid
      }).get()
      if (resUser.data.length > 0){
        this.setData({
          collection:resUser.data[0].collection
        })
        wx.setStorageSync('userCollection', resUser.data[0].collection)
      }
    }else{
      this.setData({
        collection: userCollection
      })
    }
  },
  

  deleteCollection(e){
    const index = e.target.dataset.idx;
    wx.showModal({
      title: '删除收藏',
      content: '确认将项目《' + this.data.collection[index].title + '》从收藏中删除？',
      success: res => {
        if (res.confirm){
          this.deleteCollectionGood(index);
        }
      }
    })
  },

  async deleteCollectionGood(index){
    wx.showLoading({
      title: '删除中',
    })
    let collection = this.data.collection;
    collection.splice(index, 1);
    let openid = wx.getStorageSync('openid');
    wx.setStorageSync('userCollection', collection);
    await db.collection('user').doc(openid).update({
      data:{
        collection: collection
      }
    });
    this.setData({
      collection: collection
    })
    wx.hideLoading()
  },

  async showDetail(e){
    const index = e.target.dataset.idx;
    if (!this.data.collection[index].localTime){
      wx.showLoading({
        title: '读取详情',
      })
      const goodId = this.data.collection[index].goodId;
      const storageData = wx.getStorageSync(goodId + '')
      if (storageData){       
        let collection = this.data.collection;
        collection[index] = storageData;
        this.setData({
          collection: collection
        })
        wx.hideLoading();
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
        const resGood = await db.collection('goodDb').where({
          goodId:goodId
        }).get()
        if (resGood.data.length >0){
          const goodInfo = resGood.data[0];
          let collection = this.data.collection;
          collection[index] = goodInfo;
          this.setData({
            collection: collection
          })
          wx.setStorageSync(goodId + '', goodInfo)
        }else{
          this.getGoodInfo(index);
        }
        wx.hideLoading()
      }
    }else{
      let collection = this.data.collection;
      delete collection[index].localTime;
      this.setData({
        collection: collection
      })
    }

  },

  async getGoodInfo(index){
    const id = this.data.collection[index].goodId;
    wx.showLoading({
      mask:false,
    })
    await this.getGoodIntro(index,id);
    await this.getSalesItems(index,id);
    await this.getCount(index,id);
    wx.showToast({
      title: '读取完毕'
    })
    let collection = this.data.collection;
    collection[index].log=[];
    this.setData({
      collection: collection
    })
    if (this.data.status == FINISH){
      await db.collection('goodDb').add({
        data: this.data.collection[index]
      });
    }
    const d = new Date();
    const currentTime = d.getTime();
    await db.collection('goodSearchHistory').add({
      data: {
        goodId:this.data.collection[index].goodId,
        timestamp: this.getLocalTime(currentTime),
        title: this.data.collection[index].title,
        star: this.data.collection[index].star,
        money: this.data.collection[index].money,
      }
    });
    wx.hideLoading()
  },

  async getGoodIntro(index,id){
    try{
      let collection = this.data.collection;
      collection[index].log=['读取项目简介；'];
      this.setData({
        collection: collection
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
      wx.showLoading({
        mask:false,
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
      collection[index].goodId = goodIntro.goodsid
      collection[index].startTime= goodIntro.salestartat
      collection[index].endTime= goodIntro.saleendat
      collection[index].star= goodIntro.starList
      collection[index].title= goodIntro.title
      collection[index].fanClub= goodIntro.owner.nickname
      collection[index].status = status
      collection[index].star = star
      collection[index].localTime = localTime
      this.setData({
        collection: collection
      })
    }catch (e){
      console.log(e);
    }
  },

  async getSalesItems(index,id) {
    try {
      let collection = this.data.collection;
      collection[index].log.push('读取项目商品信息；');
      this.setData({
        collection: collection
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
      collection[index].salesItems = salesItems;
      this.setData({
        collection: collection
      })
    } catch (e) {
      console.log(e);
    }
  },

  async getCount(index,id) {
    try{
      let collection = this.data.collection;
      collection[index].log.push('读取排名信息（一页100人）');
      this.setData({
        collection: collection
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
        let countPage = await this.getCountPage(index, id, page);
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
      collection[index].userClass = userClass
      collection[index].userCount = userCount
      collection[index].money = money.toFixed(2)
      collection[index].average = (money/userCount).toFixed(2)
      this.setData({
        collection: collection
      })
    }catch(e){
      console.log(e);
    }
  },

  async getCountPage(index, id, page) {
    try {
      let collection = this.data.collection;
      collection[index].log.push('读取第'+page+'页');
      this.setData({
        collection: collection
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

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function (res) {
    return {
      title: 'Owaht数据助手',
      path: '/pages/collection/index'
    }
  }
})