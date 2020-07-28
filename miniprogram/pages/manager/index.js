// miniprogram/pages/manager/index.js
const db = wx.cloud.database();
const _ = db.command
Page({

  /**
   * 页面的初始数据
   */
  data: {
    id: '',
    aim: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {

  },

  async formSubmit(e) {
    console.log('form发生了submit事件，携带数据为：', e.detail.value)
    let id = e.detail.value.id;
    let aim = parseInt(e.detail.value.aim);
    this.setData({
      id,
      aim
    })
    if (!id){
      wx.showToast({
        title: '请填写项目id',
        icon: "none"
      })
    }else{
      let myContent = '确认添加id为'+ id;
      if (aim){
        myContent += ", 目标金额为" + aim + '的新项目？';
      }else{
        myContent += ', 无目标金额的新项目?';
      }
      wx.showModal({
        content:myContent,
        success: res => {
          if (res.confirm){
            this.addGood(id, aim);
          }
        }
      })
    }
  },

  async addGood(id, aim){
    wx.showLoading({
      title: '添加中',
    })
    const resGoodId = await db.collection('goodId').where({
      goodId: id
    }).get();
    const gooIdList = resGoodId.data;
    if (gooIdList.length > 0){
      wx.hideLoading({
        complete: (res) => {},
      })
      wx.showToast({
        title: '添加失败：项目已存在',
        icon: "none"
      })
    } else {
      if(aim){
        db.collection('goodId').add({
          data: {
            goodId: id,
            isFinish: false,
            aim: aim
          }
        }).then(res => {
          wx.hideLoading({
            complete: (res) => {
              wx.showToast({
                title: '添加成功',
              })
            },
          })
          console.log(res);
        });
      }else{
        db.collection('goodId').add({
          data: {
            goodId: id,
            isFinish: false,
          }
        }).then(res => {
          wx.hideLoading({
            complete: (res) => {
              wx.showToast({
                title: '添加成功',
              })
            },
          })
        });
      }

    }
    console.log(resGoodId);
  }

})