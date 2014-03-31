function htmlEncode(value){
  return $('<div/>').text(value).html();
}

function findStation(v) {
  for (var i = 0, l = allStations.length; i < l; i++) {
    if (v == allStations[i]) {
      return i;
    }
  }
  return -1;
}

$.fn.serializeObject = function() {
   var o = {};
   var a = this.serializeArray();
   $.each(a, function() {
      if (o[this.name] !== undefined) {
         if (!o[this.name].push) o[this.name] = [o[this.name]];
         o[this.name].push(this.value || '');
      } else {
         o[this.name] = this.value || '';
      }
   });
   return o;
};
$.ajaxPrefilter( function( options, originalOptions, jqXHR ) {
   options.url = 'http://127.0.0.1:8080/' + document.getElementsByTagName("title")[0].innerHTML + options.url;
});

var Depenses = Backbone.Collection.extend({
   url: '/depenses'
});
var Depense = Backbone.Model.extend({
   urlRoot: '/depenses'
});

var depenseListView = Backbone.View.extend({
   el: '.page',
   render: function () {
      var that = this;
      var depenses = new Depenses();
      depenses.fetch({
         success: function (l) {
            var template = _.template($('#depense-list-template').html(), {l: l.models});
            that.$el.html(template);
         }
      })
   }
});
var depenseListView = new depenseListView();

var depenseEditView = Backbone.View.extend({
  el: '.page',
  events: {
    'submit .edit-depense-form': 'saveDepense',
    'click  .edit-depense-form .delete': 'deleteDepense',
    'click .station': 'clickStation',
    'click #action_favoris': 'clickActionFavoris',
    'blur #f1station': 'blurStation'
  },
  'clickActionFavoris': function (ev) {
    var v = $('#f1station').val(), found = findStation(v);
    var e = document.getElementById('div_favoris');
    if (found === -1) {
      allStations.unshift(v);
      console.log('added ' + v);
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.className = 'station';
      a.href = '#';
      a.appendChild(document.createTextNode(v));
      li.appendChild(a);
      if (e.nextSibling) {
        e.parentElement.insertBefore(li, e.nextSibling);
      } else {
        e.parentElement.appendChild(li);
      }
      $('#action_favoris').text('Supprimer');
    } else {
      allStations.splice(found, 1);
      console.log('splice ' + found);
      while (found > 0) {
        e = e.nextSibling;
        found = found - 1;
      }
      console.log('e.text ' + e.nextSibling.innerHTML);
      e.parentElement.removeChild(e.nextSibling);
      $('#action_favoris').text('Ajouter');
    }
    ev.preventDefault(); // avoid navigation
    return true; // but close the menu
  },
  'blurStation': function (ev) {
    var found = false, v = $('#f1station').val();
    for (var i = 0, l = allStations.length; i < l; i++) {
      if (v == allStations[i]) {
        console.log(v + ' == ' + allStations[i]);
        found = true;
      }
    }
    console.log('blurStation ' + (found ? 'true' : 'false'));
    $('#action_favoris').text(found ? 'Supprimer' : 'Ajouter');
  },
  clickStation: function (ev) {
    //console.log('clickStation ' + $(ev.currentTarget).text());
    $('#f1station').val($(ev.currentTarget).text());
    $('#action_favoris').text('Supprimer');
    ev.preventDefault(); // avoid navigation
    return true; // but close the menu
  },
  saveDepense: function (ev) {
    var details = $(ev.currentTarget).serializeObject();
    var depense = new Depense();
    depense.save(details, {
      success: function (site) {
        router.navigate('', {trigger:true});
      }
    });
    return false;
  },
  deleteDepense: function (ev) {
    console.log('deleteDepense is called');
    this.depense.destroy({
      success: function () {
        console.log('destroyed');
        router.navigate('', {trigger:true});
      }
    });
    return false;
  },
  render: function (options) {
    var that = this;
    if(options.id) {
      that.depense = new Depense({id: options.id});
      that.depense.fetch({
        success: function (el) {    
          var template = _.template($('#edit-depense-template').html(), {el: el, v:allStations});
          that.$el.html(template);
        }
      })
    } else {
      var template = _.template($('#edit-depense-template').html(), {el: null, v:allStations});
      that.$el.html(template);
    }
  }
});

var depenseEditView = new depenseEditView();

var Router = Backbone.Router.extend({
   routes: {
      "": "home", 
      "edit/:id": "edit",
      "new": "edit"
   }
});
var router = new Router;
router.on('route:home', function() {
  console.log('router.on route:home');
  depenseListView.render();
});
router.on('route:edit', function(id) {
  console.log('router.on route:edit');
  depenseEditView.render({id: id});
});

Backbone.history.start();

var allStations;
$.get('/stations', {}, function (v) {
    allStations = v;
    console.log('allStations: ' + JSON.stringify(v));
  });