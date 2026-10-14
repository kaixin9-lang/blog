(() => {
  const form=document.querySelector('#author-form');if(!form)return;
  const status=document.querySelector('#author-status'),submit=document.querySelector('#author-submit');
  if(form.dataset.mode==='setup'&&location.hash.startsWith('#code=')){document.querySelector('#setup-token').value=decodeURIComponent(location.hash.slice(6));history.replaceState(null,'',location.pathname);}
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(submit.disabled||!form.reportValidity())return;
    const password=document.querySelector('#author-password').value,setup=form.dataset.mode==='setup';
    if(setup&&password!==document.querySelector('#confirm-password').value){status.textContent='两次密码不一致，请检查。';return;}
    submit.disabled=true;status.textContent=setup?'正在设置作者密码…':'正在登录…';
    try{
      const response=await fetch('/author/'+(setup?'setup':'login'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Footprints-Editor':'1'},body:JSON.stringify({password,...(setup?{token:document.querySelector('#setup-token').value}:{})})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'登录失败，请稍后重试。');location.assign('/write/');
    }catch(error){status.textContent=error.message;}finally{submit.disabled=false;}
  });
})();
