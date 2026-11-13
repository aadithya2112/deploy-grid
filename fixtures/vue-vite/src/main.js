import { createApp, h } from 'vue'; createApp({render:()=>h('main',[h('h1','Vue deployment works'),h('a',{href:'/nested/route'},'Nested route')])}).mount('#app');
