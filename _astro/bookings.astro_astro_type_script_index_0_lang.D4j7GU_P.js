import{a as i,s as o}from"./admin.C-lpuL-Z.js";const n=a=>document.getElementById(a);function e(a){return String(a??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function d(a){if(!a)return"";try{return new Date(a).toLocaleString("vi-VN")}catch{return a}}async function r(){const a=await i("GET","/bookings");if(a.status===401){n("list-status").innerHTML='Chưa đăng nhập — <a href="/admin" class="underline">Đăng nhập tại đây</a>.';return}if(!a.data?.ok){n("list-status").textContent="Không tải được danh sách.";return}const s=a.data.bookings||[],l=s.filter(t=>t.status!=="read").length;n("list-status").textContent=`${s.length} yêu cầu · ${l} chưa xem.`,n("booking-list").innerHTML=s.length?s.map(t=>`
            <li class="rounded-2xl bg-paper p-4 shadow-[var(--shadow-lift-1)] ${t.status!=="read"?"border-2 border-sea/40":""}">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-semibold text-ink">
                    ${e(t.name)} · ${e(t.phone)}
                    ${t.status!=="read"?'<span class="ml-2 rounded-full bg-sea px-2 py-0.5 text-xs font-semibold text-white">Mới</span>':""}
                  </p>
                  <p class="mt-1 text-xs text-ink-soft">${d(t.created_at)}${t.email?" · "+e(t.email):""}${t.dia_chi?" · "+e(t.dia_chi):""}</p>
                  <div class="mt-2 grid gap-1 text-sm text-ink-soft sm:grid-cols-2">
                    <p><span class="font-medium text-ink">Tour:</span> ${e(t.tour_name||t.tour_slug||"—")}</p>
                    <p><span class="font-medium text-ink">Loại tour:</span> ${e(t.loai_tour||"—")} ${t.loai_diem_den?"· "+e(t.loai_diem_den):""}</p>
                    <p><span class="font-medium text-ink">Khu vực:</span> ${e(t.khu_vuc||"—")}</p>
                    <p><span class="font-medium text-ink">Nơi đến:</span> ${e(t.noi_den||"—")}${t.noi_den_khac?" ("+e(t.noi_den_khac)+")":""}</p>
                    <p><span class="font-medium text-ink">Nơi khởi hành:</span> ${e(t.noi_khoi_hanh||t.departure||"—")}</p>
                    <p><span class="font-medium text-ink">Ngày đi / về:</span> ${e(t.ngay_khoi_hanh||t.departure_date||"—")}${t.ngay_ve?" → "+e(t.ngay_ve):""}</p>
                    <p><span class="font-medium text-ink">Số khách:</span> Người lớn ${e(t.nguoi_lon||t.guests||"—")} · Trẻ em ${e(t.tre_em||"0")} · Em bé ${e(t.em_be||"0")}</p>
                  </div>
                  ${t.yeu_cau_khac||t.note?`<p class="mt-2 rounded-xl bg-sand/60 px-3 py-2 text-sm text-ink-soft">${e(t.yeu_cau_khac||t.note)}</p>`:""}
                </div>
                ${t.status!=="read"?`<button data-read="${t.id}" class="shrink-0 rounded-full bg-sea px-4 py-1.5 text-sm font-semibold text-white hover:bg-sea-deep">Đã xem</button>`:""}
              </div>
            </li>`).join(""):'<li class="text-sm text-ink-soft">Chưa có yêu cầu đặt tour nào.</li>',n("booking-list").querySelectorAll("[data-read]").forEach(t=>t.addEventListener("click",async()=>{o(t,!0,"Đang cập nhật...");try{await i("PUT",`/bookings/${t.dataset.read}/read`)}finally{o(t,!1)}r()}))}r();
