import cache from '../src';

const blog = {
    getPost(id) {
        return new Promise((res, rej) => {
            setTimeout(() => {
                fetch(`https://jsonplaceholder.typicode.com/posts/${id}`)
                    .then(response => response.json())
                    .then(rej)
                    .catch(rej)
            }, 10000)
        })
    }
};

const cachedBlog = cache(blog);

window.cachedBlog = cachedBlog;


cachedBlog.getPost(1).then(console.log);
cachedBlog.getPost(2).then(console.log);
cachedBlog.getPost(3).then(console.log);
cachedBlog.getPost(4).then(console.log);


