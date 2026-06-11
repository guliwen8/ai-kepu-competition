export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/public/index',
    'pages/submit/index',
    'pages/submissions/index',
    'pages/submission-detail/index',
    'pages/mine/index',
    'pages/login/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'AI科普大赛',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#4E5969',
    selectedColor: '#165DFF',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页'
      },
      {
        pagePath: 'pages/submit/index',
        text: '报名'
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的'
      }
    ]
  }
})
