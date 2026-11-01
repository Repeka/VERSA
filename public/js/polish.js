// VERSA extras: click an artwork to see it big, and preview an image before uploading.

(function () {
  // ---------- Click an artwork to see it big ----------
  var overlay;

  function openLightbox(src, alt) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'lightbox';
      overlay.innerHTML =
        '<button type="button" class="lightbox-close" aria-label="Close">✕</button><img alt="">';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', closeLightbox);
    }
    var image = overlay.querySelector('img');
    image.src = src;
    image.alt = alt || '';
    overlay.classList.add('open');
    document.body.classList.add('no-scroll');
  }

  function closeLightbox() {
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.classList.remove('no-scroll');
  }

  document.addEventListener('click', function (event) {
    if (!(event.target instanceof Element)) return;
    var image = event.target.closest('.post-image, .entry > img');
    if (image) openLightbox(image.src, image.alt);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeLightbox();
  });

  // ---------- Preview an image before uploading it ----------
  document.addEventListener('change', function (event) {
    var input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
    if (!input.accept || input.accept.indexOf('image') === -1) return;

    var preview = input.nextElementSibling;
    if (!preview || !preview.classList.contains('upload-preview')) {
      preview = document.createElement('img');
      preview.className = 'upload-preview';
      preview.alt = 'Preview of your image';
      input.insertAdjacentElement('afterend', preview);
    }

    if (preview.dataset.url) URL.revokeObjectURL(preview.dataset.url);

    var file = input.files && input.files[0];
    if (!file) {
      preview.remove();
      return;
    }

    var url = URL.createObjectURL(file);
    preview.dataset.url = url;
    preview.src = url;
  });
})();