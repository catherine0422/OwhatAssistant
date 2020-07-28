// miniprogram/pages/finish/index.js
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
    lastUpdate: '',
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
      status: FINISH
    }).get();
    const goodInfoList = response.data;
    for (let goodInfo of goodInfoList){
      goodInfo.currentSalesInfo = goodInfo.salesInfo[goodInfo.salesInfo.length - 1];
      if (goodInfo.aim){
        let aim = goodInfo.aim;
        let money = goodInfo.currentSalesInfo.money;
        goodInfo.progress = parseInt(money*100/aim);
      }
      goodInfo.duration = this.timeDiff(goodInfo.startTime, goodInfo.endTime);
    }
    const lastTime = this.getLocalTime(goodInfoList[0].currentSalesInfo.time);
    this.setData({
      goodInfoList: goodInfoList,
      lastTime
    })
  },

  timeDiff(start, end){
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
      timeDiff += hours + '小时';
    }
    if (minutes>0){
      timeDiff += minutes + '分钟';
    }
    return timeDiff;
  },

  getLocalTime(nS) {
    let time = new Date(parseInt(nS));
    let hours = time.getHours();
    let minutes = time.getMinutes();
    return hours + ':' + minutes;
  },
  
  deleteItem(e){
    console.log(e);
    let goodId = e.target.dataset.id;
    let name = e.target.dataset.name;
    wx.showModal({
      content: '确认删除项目《'+ name +'》?',
      success: res => {
        if (res.confirm){
          this.deleteItemId(goodId);
        }
      }
    })
  },

  async deleteItemId(id){
    wx.showLoading({
      title: '删除中'
    })
    const res = await wx.cloud.callFunction({
      name: 'deleteItem',
      data: {
        id: id
      }
    })
    await this.getGoodInfoList();
    wx.hideLoading({
      complete: (res) => {
        wx.showToast({
          title: '删除成功',
        })
      },
    })
  }
})