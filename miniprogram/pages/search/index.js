// miniprogram/pages/search/index.js
const FINISH = 'finish';
const START = 'start';
const NOT_START = 'not start';

const TYPE_LARGER_FIVE = 1;
const TYPE_SMALLER_FIVE = 2;
const TYPE_STORED = 3;
const TYPE_FINISH = 4;
const TYPE_ON_QUERY = 5;
const TYPE_FIRST_QUERY = 6;
const TYPE_ON_QUERY_OUT_OF_TIME = 7;

const db = wx.cloud.database()
const _ = db.command
Page({

  /**
   * 页面的初始数据
   */
  data: {
    showItems: false,
    showUserClass:false,
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
    collected: false,
    log: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: async function (options) {
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
        btnDisable: true,
        collected: false
      })
      wx.showLoading({
        title: '搜索中',
      })
      console.log('查询项目',goodId);
      const storageData = wx.getStorageSync(goodId + '')
      const d = new Date();
      let currentTime = d.getTime();

      // 已结束项目，曾经查询过，存储在storagedata里
      if (storageData){
        console.log('已结束项目，曾经查询过，存储在storagedata里');
        wx.hideLoading();
        this.showGood(storageData)
        await db.collection('goodSearchHistory').add({
          data: {
            goodId:goodId,
            timestamp: this.getLocalTime(currentTime),
            title: storageData.title,
            star: storageData.star,
            money:storageData.money,
            type: TYPE_STORED,
          }
        });
        wx.reportAnalytics('query_in_search', {
          search_id: goodId,
          search_star: storageData.star,
          search_title: storageData.title,
        });
      // 未存储在storagedata里
      }else{
        const resGoodDb = await db.collection('goodDb').where({
          goodId:goodId,
        }).get();
        const goodDb = resGoodDb.data[0];
        let needNewQuery = false; // 需要重新读取数据
        let type;

        // 已查询过
        if (goodDb){
          this.showGood(goodDb);
          if (!goodDb.onQuery && goodDb.status == FINISH){
            wx.setStorageSync(goodDb.goodId + '', goodDb)
            type = TYPE_FINISH;
            wx.hideLoading()
          }else{
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

        // 添加搜索记录
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

        // 给微信统计报备
        if(goodDb){
          wx.reportAnalytics('query_in_search', {
            search_id: goodId,
            search_star: goodDb.star,
            search_title: goodDb.title,
          });
        }else{
          wx.reportAnalytics('query_in_search', {
            search_id: goodId,
            search_star: 'none',
            search_title: 'none',
          });
        }

      }
    }
  },

  showGood(goodDb){
    this.setData({
      btnDisable: false,
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

  question(){
    wx.showModal({
      title:'项目id读取方式',
      content:'在owhat某项目页面中，点击分享，选择复制链接，链接中的id=*******，即为此项目id。',
      showCancel:false
    })
  },

  collect(){
    if (this.data.userCount != ''){
      wx.showModal({
        title: '添加收藏',
        content: '确认收藏项目《' + this.data.title + '》？',
        success: res => {
          if (res.confirm){
            this.collectGood(this.data.goodId);
          }
        }
      })
    }else {
      wx.showToast({
        title: '请先查询项目',
        icon: "none"
      })
    }
  },

  async collectGood(goodId){
    wx.showLoading({
      title: '添加收藏中',
    });
    let userCollection = wx.getStorageSync('userCollection')
    let openid = wx.getStorageSync('openid');;
    let hasCount = false;
    if (userCollection){
      console.log('已存在本地')
      hasCount = true;
    }else{
      console.log('未存在本地')
      const resUser = await db.collection('user').where({
        _openid: openid
      }).get()
      if (resUser.data.length > 0){
        console.log('云端有账户')
        userCollection = resUser.data[0].collection;
        hasCount = true;
      }else{
        hasCount = false;
      }
    }

    if (hasCount){
      if (userCollection.findIndex( ele => ele.goodId == this.data.goodId) >= 0){
        console.log('已收藏项目')
        wx.hideLoading({
          complete: (res) => {
            wx.showToast({
              title: '您之前已收藏此项目',
              icon: "none"
            })
          },
        })
      }else {
        console.log('未收藏项目')
        userCollection.push({
          goodId: this.data.goodId,
          star: this.data.star,
          title: this.data.title
        })
        await db.collection('user').doc(openid).update({
          data: {
            collection: userCollection
          }
        })
        console.log('云端添加项目')
      }
    }else{
      console.log('云端无账户')
      userCollection = [{
        goodId: this.data.goodId,
        star: this.data.star,
        title: this.data.title
      }]
      await db.collection('user').add({
        data:{
          _id: openid,
          _openid: openid,
          collection: userCollection
        }
      });
      console.log('新增账户')
    }

    wx.setStorageSync('userCollection', userCollection)

    this.setData({
      collected: true
    })
    wx.hideLoading();
  },

  toggleItems(){
    let showItems = !this.data.showItems;
    this.setData({
      showItems
    });
  },

  toggleClass(){
    let showClass = !this.data.showClass;
    this.setData({
      showClass
    });
  },

  onShareAppMessage: function (res) {
    return {
      title: 'Owaht数据助手',
      path: '/pages/search/index'
    }
  }

})