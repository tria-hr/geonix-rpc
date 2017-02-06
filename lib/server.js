const express = require('express')
const bodyParser = require('body-parser')

class RPCServer {

	constructor() {
		this.server = express()		

		// rpc server helper functions
		this.server.use((req, res, next) => {
			res.ok = (result) => res.send({ status: 'ok', result: result })
			res.error = (error) => res.send({ status: 'error', error: error })

			next()
		})

		this.sessions = {}
	}

	listen(port) {
		this.server.listen(port)
	}

	stateless(path, handlerClass) {
	stateless(path, handlerClass, ...args) {
		if(!path)
			return
		if(!handlerClass)
			return

		let app = express()
		let handler = new handlerClass()

		app.get('*', async (req, res) => {
			let [_, method, ...args] = Object.values(req.params).shift().split('/')

			if(!method)
				return res.error('missing method')

			await this.callMethod(handler, req, res, method, args)
		})

		app.post('*', bodyParser.json(), async (req, res) => {
			if(!req.body)
				return res.error('invalid request')
			if(!req.body.method)
				return res.error('missing method')

			await this.callMethod(handler, req, res, req.body.method, req.body.arguments || [])
		})

		this.server.use(path, app)
	}

	generateSession(handlerClass) {

		// create randome session id
		const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstvuwxyz0123456789'
		let sid = ''
		while(sid.length < 12)
			sid += charset[Math.round(Math.random() * charset.length)]

		let session = {
			id: sid,
			handler: new handlerClass
		}

		// let handler be aware of the session
		session.handler.session = session

		// added session to the list
		this.sessions[session.id] = session

		return session
	}

	stateful(path, handlerClass) {
		let app = express()
		
		app.get('*', async (req, res) => {
			let [_, method, ...args] = Object.values(req.params).shift().split('/')
			let session = null

			if(!method)
				return res.error('missing method')

			// if sid is provided, use that session
			if(args.length > 0 && args[0].toString().startsWith('$'))
				session = this.sessions[args.shift().slice(1)]

			// if we still don't have a session, start new session and redirect
			if(!session) 
				return res.redirect(req.baseUrl.split('/').concat([method, '$' + this.generateSession(handlerClass).id]).concat(args).join('/'))

			await this.callMethod(session.handler, req, res, method, args)
		})

		app.post('*', bodyParser.json(), async (req, res) => {
			if(!req.body)
				return res.error('invalid request')
			if(!req.body.method)
				return res.error('missing method')

			let session = null
			let args = req.body.arguments || []

			// if sid is provided, use that session
			if(args.length > 0 && args[0].toString().startsWith('$'))
				session = this.sessions[args.shift().slice(1)]

			// if we still don't have a session, start new session and redirect
			if(!session)
				return res.redirect(req.baseUrl.split('/').concat([method, '$' + this.generateSession(handlerClass).id]).concat(args).join('/'))

			await this.callMethod(handler, req, res, req.body.method, args)
		})

		this.server.use(path, app)	
	}	

	// call method
	async callMethod(handler, req, res, _method, args) {
		try {
			let method = handler[_method]

			if(!method)
				return res.error('unknown method')

			let result = method.apply(handler, args)

			if(result instanceof Promise)
				result = await result

			if(result instanceof Error)
				return res.error(result.toString())

			res.ok(result)
		} catch(error) {
			res.error(error.toString())
		}
	}

}

module.exports = RPCServer