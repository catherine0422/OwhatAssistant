// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  try{
    let {id} = event;
    await db.collection('goodId').where({
      goodId:id
    }).remove()
    await db.collection('goodInfo').where({
      goodId:id
    }).remove()
    return { isSuccess: true}
  }catch(e) {
    console.error(e)
    return { isSuccess: false,
              errMes: e}
  }
}