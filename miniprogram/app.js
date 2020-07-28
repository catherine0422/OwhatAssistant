//app.js
App({
  onLaunch: function () {
    
    wx.cloud.init({
      env: 'owhatdata-fklf2'
    })

    this.globalData = {}
  }
})
