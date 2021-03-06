/* Copyright (c) 2012-2015 Richard Rodger, MIT License */
"use strict";


var util = require('util')

var _       = require('lodash')
var uuid    = require('node-uuid')
var Cookies = require('cookies')


module.exports = function engage( options ) {
  var seneca = this
  var plugin = "engage"


  options = seneca.util.deepextend({
    tokenkey:'seneca-engage', // name of cookie
  },options)

 
  seneca.add({role:plugin,cmd:'set'},cmd_set)
  seneca.add({role:plugin,cmd:'get'},cmd_get)


  function create_engage(seneca,done) {
    seneca.make$('sys/engage',{id$:uuid()}).save$(done)
  }


  function ensure_engage(seneca,token,error,handler) {
    seneca
      .make$('sys/engage')
      .load$(token,function(err,engage){
        if( err ) return error(err);

        if( engage ) {
          seneca.log.debug('found',token)
          return handler(engage);
        }

        create_engage(seneca,function(err,engage){
          if( err ) return error(err);

          seneca.log.debug('create', engage.id)
          return handler(engage);
        })
      })
  }
  
  
  function setone(engage,key,value, done ) {
    engage[key]=value
    engage.save$(done)
  }

  function setmany(engage,values, done ) {
    engage.data$(values).save$(done)
  }

  function getone(seneca, token, key, done ) {
    ensure_engage(seneca, token, done, function(engage){
      done(null,{value:engage[key]})
    })
  }

  function getmany(seneca, token, done ) {
    ensure_engage(seneca, token, done, function(engage){
      done(null,engage.data$())
    })
  }



  function cmd_set( args, done ) {

    var token = args.token || 
      (args.context && args.context.engage_token) || 
      (args.req$ && args.req$.seneca && args.req$.seneca.engage_token )

    ensure_engage( this, token, done, do_set )

    function do_set(engage) {
      if( null != args.key ) {
        setone( engage, args.key, args.value, set_token )
      }
      else {
        setmany( engage, args.values, set_token )
      }
    }


    function set_token(err, engage) {
      if( err ) return done(err);
      var token = engage.id
      
      if( args.context ) {
        args.context.engage_token = token
      }

      if( args.res$ && args.req$.seneca ) {
        args.req$.seneca.engage_token = token
        var cookies = args.req$.seneca.cookies || new Cookies(args.req$,args.res$)
        cookies.set( options.tokenkey, token )
      }

      done(null,{token:token})
    }
  }


  function cmd_get( args, done ) {
    var token = args.token || 
          (args.context && args.context.engage_token) || 
          (args.req$ && args.req$.seneca && args.req$.seneca.engage_token )
          
    if( !token ) return done( null, {});

    if( args.key ) {
      getone( this, token, args.key, done )
    }
    else {
      getmany( this, token, done )
    }
  }



  seneca.act({role:'web',use:function(req,res,next) {
    var cookies = req.seneca.cookies || new Cookies(req,res)
    var token = cookies.get(options.tokenkey)

    if( token ) {
      req.seneca.engage_token = token
    }

    next()
  }})



  return {
    name:plugin
  }
}
