const { exec } = require('node:child_process')

const map = {
  b: 'docker:/root/work/yl02/sdk/three-example',
  // 内网
  inner: 'website-1:/srv/yl02/cdn/sdk/three-example-xqb',
  // 内网 合并后的环境
  merge: 'website-1:/srv/yl02/cdn/sdk/three-example-merge',

}

// 获取命令行参数
// eslint-disable-next-line no-shadow-restricted-names
const arguments = process.argv.splice(2)

const env = arguments[0] || undefined

if (!env) {
  console.log('缺少环境参数')
  return
}

if (!map[env]) {
  console.log('未知的目标主机')
  return
}

// 读取package.json中的版本信息
const pjson = require('../package.json')
const version = pjson.version

exec(`rsync -az dist/ ${map[env]}@${version}`, (err, output) => {
  if (err) {
    console.error('could not execute command: ', err)
    return
  }
  console.log(`three-render-example 发布到${env}环境成功: \n， 发布版本为${version}`, output)
})
