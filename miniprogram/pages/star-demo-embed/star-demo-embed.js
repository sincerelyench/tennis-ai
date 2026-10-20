Page({
  data: { src: "" },
  onLoad(query) {
    let src = (query && query.src) || "";
    try {
      src = decodeURIComponent(src);
    } catch (e) {
      /* keep raw */
    }
    this.setData({ src: src });
  },
});
