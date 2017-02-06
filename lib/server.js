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

		this.server.use(bodyParser.json())
	}

	listen(port) {
		this.server.listen(port)
	}

	addHandler(path, handlerClass) {
		let app = express()
		let handler = new handlerClass()

		app.get('*', async (req, res) => {
			let [_, method, ...args] = Object.values(req.params).shift().split('/')

			await this.callMethod(handler, req, res, method, args)
		})

		app.post('*', async (req, res) => {
			if(!req.body)
				return res.error('invalid request')
			if(!req.body.method)
				return res.error('missing method')

			await this.callMethod(handler, req, res, req.body.method, req.body.arguments || [])
		})

		this.server.use(path, app)
	}

	async callMethod(handler, req, res, _method, args) {
		try {
			let method = handler[_method]

			if(!method)
				return res.error('unknown method')

			let result = method.apply(handler, args)

			if(result instanceof Promise)
				result = await result

			res.ok(result)
		} catch(error) {
			res.error(error.toString())
		}
	}

}

module.exports = RPCServer