(function (global) {
  'use strict';

  function noopArray() {
    return [];
  }

  function noopNull() {
    return null;
  }

  function ContentService(provider) {
    this.provider = provider || {};
  }

  ContentService.prototype.setProvider = function (provider) {
    this.provider = provider || {};
  };

  ContentService.prototype.getRawArticleHtml = function () {
    if (typeof this.provider.getRawArticleHtml === 'function') {
      return this.provider.getRawArticleHtml();
    }
    return '';
  };

  ContentService.prototype.getPosts = function () {
    if (typeof this.provider.getPosts === 'function') {
      return this.provider.getPosts();
    }
    return noopArray();
  };

  ContentService.prototype.getPost = function (slug) {
    if (typeof this.provider.getPost === 'function') {
      return this.provider.getPost(slug);
    }
    return noopNull();
  };

  ContentService.prototype.getPostContentHtml = function (postId) {
    if (typeof this.provider.getPostContentHtml === 'function') {
      return this.provider.getPostContentHtml(postId);
    }
    return '';
  };

  ContentService.prototype.getFeaturedPost = function () {
    if (typeof this.provider.getFeaturedPost === 'function') {
      return this.provider.getFeaturedPost();
    }
    return noopNull();
  };

  ContentService.prototype.getCategories = function (posts) {
    if (typeof this.provider.getCategories === 'function') {
      return this.provider.getCategories(posts || this.getPosts());
    }
    return noopArray();
  };

  ContentService.prototype.searchPosts = function (posts, term) {
    if (typeof this.provider.searchPosts === 'function') {
      return this.provider.searchPosts(posts || this.getPosts(), term || '');
    }
    return posts || noopArray();
  };

  ContentService.prototype.filterPosts = function (posts, filters) {
    if (typeof this.provider.filterPosts === 'function') {
      return this.provider.filterPosts(posts || this.getPosts(), filters || {});
    }
    return posts || noopArray();
  };

  ContentService.prototype.buildPostRecords = function (cards) {
    if (typeof this.provider.buildPostRecords === 'function') {
      return this.provider.buildPostRecords(cards || []);
    }
    return noopArray();
  };

  global.ContentService = new ContentService();
})(window);
