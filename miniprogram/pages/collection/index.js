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
      // 显示项目
      wx.showLoading({
        title: '读取详情',
      })
      const goodId = this.data.collection[index].goodId;
      const storageData = wx.getStorageSync(goodId + '');
      const d = new Date();
      const currentTime = d.getTime();
      if (storageData){
        // 项目保存在storage中       
        let collection = this.data.collection;
        collection[index] = storageData;
        this.setData({
          collection: collection
        })
        wx.hideLoading();
        await db.collection('goodSearchHistory').add({
          data: {
            goodId:goodId,
            timestamp: this.getLocalTime(currentTime),
            title: storageData.title,
            star: storageData.star,
            money: storageData.money,
          }
        });
      }else{
        const resGoodDb = await db.collection('goodDb').where({
          goodId:goodId
        }).get()
        const goodDb = resGoodDb.data[0];
        let needNewQuery = false; // 需要重新读取数据
        if (goodDb){
          this.showGood(goodDb, index);
          if (goodDb.status == FINISH){
            wx.setStorageSync(goodDb.goodId + '', goodDb)
            wx.hideLoading()
          }else{
            if (!goodDb.onQuery && goodDb.lastQueryTime){
              // 并未正在查询， 且有最近更新时间
              if(currentTime - goodDb.lastQueryTime > 60*1000*5){
                // 距离上次查询时间大于5分钟
                needNewQuery = true;
                console.log('距上次查询大于五分钟，重新查询');
              }else{
                // 距离上次查询时间小于五分钟
                console.log('距上次查询小于五分钟')
                wx.hideLoading()
              }
            }else{
              // 正在查询中
              wx.hideLoading()
              wx.showModal({
                content:'后台读取最新数据中，请稍等片刻。（若您未点击查询，则其他用户已查询此项目。根据项目人数，查询时间为10秒-2分钟。请稍等片刻，再次查询，即可查看最新数据。）',
                showCancel:false
              })
              console.log('正在查询中');
            }
          }
        }else{
          console.log('未查询过，初次查询');
          needNewQuery = true;
        }
        if(needNewQuery){
          // 将状态更新为正在查询
          if(goodDb){
            await db.collection('goodDb').doc(goodDb._id).set({
              data:{
                onQuery: true,
                goodId: goodId
              }
            })
          }else{
            await db.collection('goodDb').add({
              data:{
                _id: goodId,
                goodId: goodId,
                onQuery: true
              }
            })
          }
          wx.hideLoading()
          wx.showModal({
            content:'后台读取最新数据中，根据项目人数将耗时10秒-1分钟。请稍等片刻，再次查询，即可查看最新数据。',
            showCancel:false
          })
          console.log('查询')
          wx.cloud.callFunction({
            name: 'getGoodInfo',
            data: {
              id : goodId
            },
          });
        }
        await db.collection('goodSearchHistory').add({
          data: {
            goodId:goodId,
            timestamp: this.getLocalTime(currentTime),
            title: goodDb.title,
            star: goodDb.star,
            money: goodDb.money,
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