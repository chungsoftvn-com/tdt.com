import test from 'node:test';
import assert from 'node:assert/strict';
import {durationDays,priceVnd,matchesDays,comparePrices} from '../src/features/discovery/tour-filters.js';
import {articleContents,relatedItems} from '../src/features/discovery/article-tools.js';
test('tour day filters distinguish nights and unknown/custom durations',()=>{
 assert.equal(durationDays('3 ngày 3 đêm'),3);assert.equal(durationDays('2N2Đ'),2);assert.equal(durationDays('1 đêm'),null);assert.equal(durationDays('Theo yêu cầu'),null);
 assert.equal(matchesDays(3,'2-3'),true);assert.equal(matchesDays(null,'1'),false);
});
test('VND prices sort numerically; contact prices always appear after priced tours',()=>{
 assert.equal(priceVnd('Từ 18.990.000đ/khách'),18990000);assert.equal(priceVnd('Liên hệ'),null);assert.equal(priceVnd('1.000 USD'),null);
 assert.deepEqual([null,900000,12000000,650000].sort((a,b)=>comparePrices(a,b,'asc')),[650000,900000,12000000,null]);
 assert.deepEqual([null,900000,12000000].sort((a,b)=>comparePrices(a,b,'desc')),[12000000,900000,null]);
});
test('contents anchors are unique for repeated headings and retain body text',()=>{
 const {blocks,toc}=articleContents([{type:'h2',text:'Giá tour'},{type:'html',html:'<h3>Giá tour</h3><p>Không gồm vé máy bay</p>'},{type:'h2',text:'Giá tour'}]);
 assert.equal(new Set(toc.map(x=>x.id)).size,3);assert.match(blocks[1].html,/Không gồm vé máy bay/);assert.match(blocks[1].html,/id="reading-section-2"/);
});
test('related results prioritize topic/category and exclude the current or hidden item',()=>{
 const current={slug:'a',title:'Thuê xe học sinh Đồng Nai',category:'Thuê xe'};
 const list=[{slug:'b',title:'Tour Nhật Bản'},{...current},{slug:'c',title:'Thuê xe đưa đón học sinh',category:'Thuê xe'},{slug:'d',title:'Thuê xe học sinh',hidden:true}];
 assert.equal(relatedItems(current,list,1)[0].slug,'c');
});

test('explicit heading anchors remain usable by existing internal links',()=>{
 const result=articleContents([{type:'html',html:'<h2 id="gia-tour">Giá</h2><a href="#gia-tour">Xem giá</a>'}]);
 assert.equal(result.toc[0].id,'gia-tour');assert.match(result.blocks[0].html,/href="#gia-tour"/);
});
