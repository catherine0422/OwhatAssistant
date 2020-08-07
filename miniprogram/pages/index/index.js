// miniprogram/pages/index/index.js
import regeneratorRuntime from '../../lib/runtime/runtime'
const db = wx.cloud.database()
const _ = db.command

const NOT_START = 'not start';
const FINISH = 'finish';
const START = 'start';
Page({

  /**
   * 页面的初始数据
   */
  data: {
    goodInfoList: [],
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    wx.showLoading({
      title: '读取数据中...',
    })
    this.getGoodInfoList().then(res => {
      wx.hideLoading({
        complete: (res) => {},
      })
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.getGoodInfoList();
  },

  async getGoodInfoList() {
    const response = await db.collection('goodInfo').where({
      status: START
    }).get();
    const goodInfoList = response.data;
    for (let goodInfo of goodInfoList){
      goodInfo.currentSalesInfo = goodInfo.salesInfo[goodInfo.salesInfo.length - 1];
      if (goodInfo.aim){
        let aim = goodInfo.aim;
        let money = goodInfo.currentSalesInfo.money;
        goodInfo.progress = parseInt(money*100/aim);
      }
      goodInfo.timeLeft = this.timeDiff(goodInfo.endTime);
    }
    const lastTime = this.getLocalTime(goodInfoList[0].currentSalesInfo.time);
    this.setData({
      goodInfoList: goodInfoList,
      lastTime
    })
  },

  timeDiff(end){
    const d = new Date();
    const currentTime = d.getTime();
    let dateDiff = end - currentTime;
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
      timeDiff += hours + '小时';
    }
    if (minutes>0){
      timeDiff += minutes + '分钟';
    }
    return timeDiff;
  },

  getLocalTime(nS) {
    console.log(nS);
    let time = new Date(parseInt(nS));
    let hours = time.getHours();
    let minutes = time.getMinutes();
    if (minutes<10){
      minutes = '0'+ minutes;
    }
    return hours + ':' + minutes;
  },

  refresh(){
    wx.showLoading({
      title: '读取数据中...',
    })
    this.getGoodInfoList().then(res => {
      wx.hideLoading({
        complete: (res) => {},
      })
    });
  },
})