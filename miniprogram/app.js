//app.js
App({
  onLaunch: function () {
    
    wx.cloud.init({
      env: 'owhatdata-fklf2'
    })

    wx.cloud.callFunction({
      name: 'getOpenid'
    }).then(res => {
      const openid = res.result.openid;
      wx.setStorage({
        data: openid,
        key: 'openid',
      });
      console.log('读取openid', openid);
    });

    this.globalData = {}
  }
})
