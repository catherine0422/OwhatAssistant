// miniprogram/pages/collection/index.js
import {request} from "../../request/index";
import {URL, HEADER_GOODINTRO, CLIENT_INFO} from "../search/cst";
const FINISH = 'finish';
const TYPE_LARGER_FIVE = 1;
const TYPE_SMALLER_FIVE = 2;
const TYPE_STORED = 3;
const TYPE_FINISH = 4;
const TYPE_ON_QUERY = 5;
const TYPE_FIRST_QUERY = 6;
const TYPE_ON_QUERY_OUT_OF_TIME = 7;

let interstitialAd = null //插页广告

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
    // 在页面onLoad回调事件中创建插屏广告实例
    if (wx.createInterstitialAd) {
      interstitialAd = wx.createInterstitialAd({
        adUnitId: 'adunit-c58478bc2a605bd6'
      })
      interstitialAd.onLoad(() => {console.log('调用插屏广告')})
      interstitialAd.onError((err) => {console.log('插屏广告错误' + err)})
      interstitialAd.onClose(() => {console.log('关闭插屏广告')})
    }
    this.getCollection();
  },

  onShow(){
    this.getCollection();
    // 在适合的场景显示插屏广告
    if (interstitialAd) {
      interstitialAd.show().catch((err) => {
        console.error(err)
      })
    }
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

  toggleItems(e){
    const index = e.currentTarget.dataset.idx;
    let collection = this.data.collection;
    if(!collection[index].showItems){
      collection[index].showItems = true;
    }else{
      collection[index].showItems = false;
    }
    this.setData({
      collection
    })
  },

  toggleClass(e){
    const index = e.currentTarget.dataset.idx;
    let collection = this.data.collection;
    if(!collection[index].showClass){
      collection[index].showClass = true;
    }else{
      collection[index].showClass = false;
    }
    this.setData({
      collection
    })
  },

  async showDetail(e){
    const index = e.target.dataset.idx;
    if (!this.data.collection[index].localTime){
      // 显示项目
      wx.showLoading({
        title: '读取详情',
      })
      const goodId = this.data.collection[index].goodId;
      const d = new Date();
      let currentTime = d.getTime();
      const resGoodDb = await db.collection('goodDb').where({
        goodId:goodId,
      }).get();
      const goodDb = resGoodDb.data[0];
      let needNewQuery = false; // 需要重新读取数据
      let type;
      if (goodDb){
        this.showGood(goodDb, index);
        if (!goodDb.onQuery && goodDb.status == FINISH){
          type = TYPE_FINISH;
          wx.hideLoading()
        }
        if (!goodDb.onQuery && goodDb.lastQueryTime){
          // 并未正在查询， 且有最近更新时间
          currentTime = d.getTime();
          if( currentTime - goodDb.lastQueryTime > 60*1000*5){
            // 距离上次查询时间大于5分钟
            needNewQuery = true;
            console.log('距上次查询大于五分钟，重新查询');
            type = TYPE_LARGER_FIVE;
          }else{
            // 距离上次查询时间小于五分钟
            console.log('距上次查询小于五分钟');
            type = TYPE_SMALLER_FIVE;
            wx.hideLoading()
          }
        }else{
          // 正在查询中
          wx.hideLoading()
          if(currentTime - goodDb.lastQueryTime > 60*1000*3){
            // 距离上次查询时间大于5分钟， query out of time, 重新查询
            needNewQuery = true;
            console.log('距上次查询大于五分钟， query out of time，重新查询');
            type = TYPE_ON_QUERY_OUT_OF_TIME;
          }else{
            // 正在查询中
            type = TYPE_ON_QUERY;
            wx.showModal({
              content:'后台读取最新数据中，请稍等片刻。（若您未点击查询，则其他用户已查询此项目。根据项目人数，查询时间为10秒-2分钟。请稍等片刻，再次查询，即可查看最新数据。）',
              showCancel:false
            })
            console.log('正在查询中');
          }    
        }
      }else{
        console.log('未查询过，初次查询');
        type = TYPE_FIRST_QUERY;
        needNewQuery = true;
      }
      if(needNewQuery){
        // 将状态更新为正在查询
        if(goodDb){
          await db.collection('goodDb').doc(goodDb._id).set({
            data:{
              onQuery: true,
              goodId: goodId,
              lastQueryTime: currentTime
            }
          })
        }else{
          await db.collection('goodDb').add({
            data:{
              _id: goodId,
              goodId: goodId,
              onQuery: true,
              lastQueryTime: currentTime
            }
          })
        }
        wx.hideLoading()
        this.setData({
          btnDisable: false
        })
        if(!goodDb || goodDb.status != FINISH){
          wx.showModal({
            content:'后台读取最新数据中，根据项目人数将耗时10秒-1分钟。请稍等片刻，再次查询，即可查看最新数据。',
            showCancel:false
          })
        }
        console.log('查询')
        wx.cloud.callFunction({
          name: 'getGoodInfo',
          data: {
            id : goodId
          },
        });
      }

      if(goodDb){
        // 之前有搜过
        await db.collection('goodSearchHistory').add({
          data: {
            goodId:goodId,
            timestamp: currentTime,
            localTime:this.getLocalTime(currentTime),
            lastQueryTime: goodDb.lastQueryTime,
            title: goodDb.title,
            star: goodDb.star,
            money: goodDb.money,
            type,
          }
        });
      }else{
        // 第一次搜索
        await db.collection('goodSearchHistory').add({
          data: {
            goodId:goodId,
            timestamp: currentTime,
            localTime:this.getLocalTime(currentTime),
            type,
          }
        });
      }
    }else{
      // 收起项目
      let collection = this.data.collection;
      delete collection[index].localTime;
      this.setData({
        collection: collection
      })
    }

  },

  showGood(goodDb, index){
    if(goodDb.title){
      let collection = this.data.collection;
      collection[index] = {
        goodId: goodDb.goodId,
        startTime: goodDb.startTime,
        endTime: goodDb.endTime,
        lastQueryTime: goodDb.lastQueryTime,
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
      };
      this.setData({
        collection: collection
      })
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