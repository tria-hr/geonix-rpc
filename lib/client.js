const request = require('request')

class RPCClient {

	static create(uri) {
		let client = new RPCClient(uri)

		return new Proxy(client, {
			get: (target, property, receiver) => {
				return function() {
					let args = Array.from(arguments)

					return new Promise(async (resolve, reject) => {
						const options = {
							uri: target.uri,
							method: 'POST',
							json: {
								'method': property,
								'arguments': args
							}
						}

						request(options, (error, r, result) => {
							if(error)
								return reject(error)

							if(result.status == 'error')
								return reject(result.error)
						
							resolve(result.result)
						})					
					})
				}
			}
		})
	}

	constructor(uri) {
		this.uri = uri		
		this.debug = false
	}

}

module.exports = RPCClient