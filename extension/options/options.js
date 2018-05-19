; (async function () {

  const callBackend = new Proxy({}, {
    get: (empty, method) => (...params) => (
      browser.runtime.sendMessage({ method, params })
    ),
  });

  await new Promise(resolve => {
    document.addEventListener('DOMContentLoaded', () => resolve());
  });

  ; (function () {
    const placeholders = Array.from(document.querySelectorAll('[data-i18n]'));
    placeholders.forEach(span => {
      const i18n = span.dataset.i18n;
      const text = browser.i18n.getMessage(i18n);
      span.textContent = text;
    });  
  }());

  const defaultFavicon = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4NCjxzdmcgd2lkdGg9IjEyOHB4IiBoZWlnaHQ9IjEyOHB4IiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCAxNiAxNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBmaWxsPSJjb250ZXh0LWZpbGwiIGZpbGwtb3BhY2l0eT0iY29udGV4dC1maWxsLW9wYWNpdHkiPg0KPHBhdGggZD0ibTYgMWE1IDUgMCAwIDAgMCAxMGE1IDUgMCAwIDAgMCAtMTB2MmEzIDMgMCAwIDEgMCA2YTIgMiAwIDAgMSAwIC02TTkuODI4IDguNDE0bC0xLjQxNCAxLjQxNEwxMi41ODU4IDE0QTEgMSAwIDAgMCAxNCAxMi41ODU4eiIvPg0KPC9zdmc+';

  const renderItem = (function () {
    /** @type {HTMLTemplateElement} */
    const template = document.getElementById('spitem').cloneNode(true);
    return function ({ id, name, favicon_url, active }) {
      const content = template.content;
      const menuText = content.querySelector('.text');
      menuText.textContent = name;
      const menuIcon = content.querySelector('.icon img');
      menuIcon.src = favicon_url;
      const checkbox = content.querySelector('input[type="checkbox"]');
      checkbox.checked = active;
      const menuItem = content.querySelector('.panel-list-item');
      menuItem.dataset.id = id;
      return menuItem;
    };
  }());

  let currentList = null;
  let currentItem = (function () {
    const rawObject = {};
    [...document.querySelectorAll('[data-from-input]')].forEach(input => {
      const attribute = input.getAttribute('data-form-target');
      const prop = input.getAttribute('data-form-attr');
      input.addEventListener('input', () => {
        rawObject[prop] = input[attribute];
      });
    });
    const faviconinput = document.getElementById('faviconinput');
    faviconinput.addEventListener('input', () => {
      const file = faviconinput.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        rawObject.favicon_url = reader.result;
        renderProp('favicon_url', rawObject.favicon_url);
        faviconinput.value = null;
      });
      reader.readAsDataURL(file);
    });
    const faviconimg = document.getElementById('faviconimg');
    faviconimg.addEventListener('error', () => {
      if (faviconimg.src !== rawObject.favicon_url) return;
      faviconimg.src = rawObject.favicon_url = defaultFavicon;
    });

    const renderProp = function (prop, value) {
      const element = document.querySelector(`[data-form-attr="${prop}"]`);
      const attribute = element.getAttribute('data-form-target');
      element[attribute] = value;
    };
    const highlightItem = function (id) {
      [...document.querySelectorAll('.panel-list-item')].forEach(menuitem => {
        menuitem.classList.remove('current');
        if (+menuitem.dataset.id === id) menuitem.classList.add('current');
      });
      const spdetail = document.getElementById('spdetail');
      spdetail.classList.remove('edit-form', 'create-form');
      spdetail.classList.add(id ? 'edit-form' : 'create-form');
    };
    return new Proxy(rawObject, {
      get: (obj, prop) => obj[prop],
      set: (obj, prop, value) => {
        if (['id', 'name', 'search_url', 'favicon_url', 'active'].includes(prop)) {
          obj[prop] = value;
          if (prop === 'id') highlightItem(value);
          else renderProp(prop, value);
        }
        return true;
      },
    });
  }());

  const renderList = async function () {
    const searchProviderList = currentList = await callBackend.getListAll();
    const menu = document.getElementById('splist');
    const menuItems = document.createDocumentFragment();
    searchProviderList.forEach(item => {
      menuItems.appendChild(document.importNode(renderItem(item), true));
    });
    menu.innerHTML = '';
    menu.appendChild(menuItems);
  };

  const focusItem = function (id) {
    Object.assign(currentItem, currentList.find(sp => sp.id === id));
  };

  const addItem = function () {
    Object.assign(currentItem, {
      id: 0,
      name: '',
      search_url: '',
      favicon_url: defaultFavicon,
      active: true,
    });
  };

  const initialList = async function () {
    await renderList();
    focusItem(currentList[0].id);
  };
  await initialList();

  document.getElementById('splist').addEventListener('click', event => {
    const item = event.target.closest('.panel-list-item'); if (!item) return;
    const id = +item.dataset.id;
    focusItem(id);
  });

  document.getElementById('faviconinputbutton').addEventListener('click', () => {
    document.getElementById('faviconinput').click();
  });

  document.getElementById('addbutton').addEventListener('click', () => {
    addItem();
  });

  document.getElementById('savebutton').addEventListener('click', async () => {
    const savedItem = await callBackend.saveItem(Object.assign({}, currentItem));
    await renderList();
    focusItem(savedItem.id);
  });

  document.getElementById('removebutton').addEventListener('click', async () => {
    const id = currentItem.id; if (!id) return;
    const index = currentList.findIndex(sp => sp.id === id); if (index === -1) return;
    callBackend.removeItem({ id });
    await renderList();
    focusItem(currentList[Math.min(index, currentList.length - 1)].id);
  });

  document.getElementById('resetbutton').addEventListener('click', async () => {
    await callBackend.resetList();
    initialList();
  });

  const movebuttons = diff => {
    return async () => {
      const id = currentItem.id; if (!id) return;
      const index = currentList.findIndex(sp => sp.id === id);
      const new_index = index + diff;
      if (new_index < 0 || new_index >= currentList.length) return;
      callBackend.moveItem({ id }, new_index);
      await renderList();
      focusItem(id);
    };
  };
  document.getElementById('moveupbutton').addEventListener('click', movebuttons(-1));
  document.getElementById('movedownbutton').addEventListener('click', movebuttons(1));

}());