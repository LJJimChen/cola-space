项目背景：

 我在这个网站购买了vpn, 但是他的订阅地址10分钟就变一次，所以我希望做一个爬虫，每天进来爬取一次新的订阅地址, 然后我起一个订阅服务，通过我自己的服务对外提供订阅地址，我的服务每天爬取一次订阅地址，并且通过订阅地址爬取一次节点并且保存

爬取步骤：

1. 登录： 

a. username: #main-container > div.no-gutters.v2board-auth-box > div > div > div > div.row.no-gutters > div > div > div:nth-child(2) > input

b. password:#main-container > div.no-gutters.v2board-auth-box > div > div > div > div.row.no-gutters > div > div > div:nth-child(3) > input

c. login button:#main-container > div.no-gutters.v2board-auth-box > div > div > div > div.row.no-gutters > div > div > div.form-group.mb-0 > button

2.等待登录到dashboard： 

3.在dashboard页面点击 #main-container > div > div:nth-child(3) > div > div > div.block-content.p-0 > div > div > div:nth-child(2)

4.点击 body > div:nth-child(7) > div > div.ant-modal-wrap.ant-modal-centered > div > div.ant-modal-content > div > div > div.item___yrtOv.subsrcibe-for-link

5. 第四步的点击就是把地址复制到了剪切板

6. 爬取到的原订阅地址，给你参考：https://45.137.180.232/api/getData/Authorize?token=4d869708250f7cbff6a721899b6df91f

7.小火箭或者clash可以通过这个订阅地址下载到节点
8.程序已经实现了一部分，你帮我修改完善