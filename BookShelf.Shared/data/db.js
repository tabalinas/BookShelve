/// <reference path="../js/jquery-1.11.2.min.js" />
/// <reference path="../js/knockout-3.3.0.js" />
/// <reference path="../js/dx.all.js" />

(function() {
    // Enable partial CORS support for IE < 10    
    $.support.cors = true;

    if(window.JSON && !window.JSON.dateParser) {
        var reISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/;

        JSON.dateParser = function(key, value) {
            if(typeof value === 'string') {
                var matched = reISO.exec(value);
                if(matched)
                    return new Date(value);
            }
            return value;
        };
    }

    var Store = function(name, config) {
        var storage = window.localStorage;

        var importData = function(data) {
            items = JSON.parse(data, JSON.dateParser) || config.defaultItems;
        };
        var read = function() {
            importData(storage.getItem(name));
        };
        var exportData = function() {
            return JSON.stringify(items);
        };
        var save = function() {
            storage.setItem(name, exportData());
        };

        var items = [];
        read();

        return {
            getAll: function() {
                return items;
            },
            get: function(id) {
                return $.grep(items, function(item) {
                    return item.id == id;
                })[0];
            },
            add: function(item) {
                var lastId = items.length ? items[items.length - 1].id : 0;
                var newId = lastId + 1;
                items.push($.extend({}, item, { id: newId }));
                save();
            },
            update: function(item) {
                $.extend(this.get(item.id), item);
                save();
            },
            remove: function(id) {
                items.splice($.inArray(this.get(id), items), 1);
                config.onRemove && config.onRemove(id);
                save();
            },
            importData: importData,
            exportData: exportData
        };
    };

    var demoBooks = [{
        id: 1,
        title: "War and Peace",
        author: "Lev Tolstoy",
        startDate: new Date(2010, 1, 1),
        finishDate: new Date(2012, 1, 1),
        notes: "#Header\n * point1\n * point2",
        tags: [1]
    }, {
        id: 2,
        title: "Crime and Punishment",
        author: "Fyodor Dostoyevsky",
        startDate: new Date(2011, 1, 1),
        tags: []
    }, {
        id: 3,
        title: "Quiet Flows the Don",
        author: "Mikhail Sholohov",
        tags: [1, 2]
    }];

    var demoTags = [{
        id: 1,
        title: "Programming"
    }, {
        id: 2,
        title: "Design"
    }];

    var bookStore = Store("books", {
        defaultItems: demoBooks
    });
    bookStore.getByTag = function(tagId) {
        return $.grep(bookStore.getAll(), function(book) {
            return $.inArray(tagId, book.tags) > -1;
        });
    };

    bookStore.loadCover = function(bookId) {
        var book = bookStore.get(bookId);
        var coverKey = book.title + " " + (book.author || "");

        if(book.cover && book.cover.key === coverKey)
            return $.when(book.cover).promise();

        var deferred = $.Deferred();

        $.ajax({
            type: "GET",
            url: "https://ajax.googleapis.com/ajax/services/search/images?v=1.0&q=" + encodeURIComponent(coverKey + " book cover"),
            dataType: "jsonp"
        }).done(function(result) {
            result = result.responseData;

            if(result && result.results && result.results[0]) {
                var img = result.results[0];

                book.cover = {
                    key: coverKey,
                    url: img.url,
                    ratio: img.height / (img.width || 1)
                };
                bookStore.update(book);

                deferred.resolve(book.cover);
            }   
        });

        return deferred.promise();
    };

    var tagStore = Store("tags", {
        defaultItems: demoTags,
        onRemove: function(id) {
            $.each(bookStore.getAll(), function(_, book) {
                book.tags = $.grep(book.tags, function(tagId) {
                    return tagId !== id;
                });
                bookStore.update(book);
            });
        }
    });

    BookShelf.db = {
        books: bookStore,

        getBookStatus: function(book) {
            return (!!book.startDate && !!book.finishDate)
                ? this.bookStatus.finished
                : (!!book.startDate ? this.bookStatus.reading : this.bookStatus.later);
        },

        bookStatus: {
            reading: "Reading",
            later: "To Read",
            finished: "Finished"
        },

        getTagsString: function(tagIds) {
            return $.map(tagIds, function(tagId) {
                return BookShelf.db.tags.get(tagId).title;
            }).join(", ");
        },

        getBookRatingStatus: function(rating) {
            if(!rating)
                return "book-rating-empty";
            if(rating < 4)
                return "book-rating-low";
            if(rating > 7)
                return "book-rating-high";
            return "book-rating-normal";
        },

        tags: tagStore
    };

}());
